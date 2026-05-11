"""Личный кабинет и администрирование пользователей."""

from django.contrib.auth import get_user_model
from django.db.models import Count
from django.db.models import Max
from django.db.models import Q

from core.models import (
    Comment,
    Directorate,
    DirectorateSubdivision,
    DirectorateWeeklyReport,
    Project,
    ProjectMembership,
    Theme,
    WorkItem,
    WorkItemStatusHistory,
)
from core.permissions import HasDirectorate

from rest_framework import mixins, serializers, status, viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.serializers import (
    DirectorateBriefSerializer,
    DirectorateSubdivisionBriefSerializer,
    ThemeBriefSerializer,
    UserBriefSerializer,
)

User = get_user_model()


def theme_detail_for_user(obj: User):
    t = Theme.resolve_for_user(obj)
    return ThemeBriefSerializer(t).data if t else None


def build_directorate_report_summary(
    *,
    directorate_id: int,
    period_start,
    period_end,
) -> str:
    from datetime import datetime, time

    from django.utils import timezone

    members_qs = User.objects.filter(is_active=True, directorate_id=directorate_id)
    member_ids = list(members_qs.values_list("id", flat=True))
    projects = (
        Project.objects.filter(memberships__user_id__in=member_ids)
        .distinct()
        .order_by("name")
    )
    project_ids = list(projects.values_list("id", flat=True))
    items = WorkItem.objects.filter(project_id__in=project_ids).select_related(
        "status", "assignee", "author"
    )
    latest_comments = (
        Comment.objects.filter(work_item__project_id__in=project_ids)
        .select_related("author")
        .order_by("work_item_id", "-created_at", "-id")
    )
    latest_comment_map: dict[int, Comment] = {}
    for comment in latest_comments:
        if comment.work_item_id not in latest_comment_map:
            latest_comment_map[comment.work_item_id] = comment

    period_start_dt = timezone.make_aware(
        datetime.combine(period_start, time.min),
        timezone.get_current_timezone(),
    )
    period_end_dt = timezone.make_aware(
        datetime.combine(period_end, time.max),
        timezone.get_current_timezone(),
    )

    def _fmt_date(value) -> str:
        if not value:
            return "—"
        try:
            return value.strftime("%d.%m.%Y")
        except Exception:
            return str(value)

    def _fmt_person(user) -> str:
        if not user:
            return "—"
        short = user.short_fio()
        return short if short else user.username

    lines = [
        f"Еженедельный отчёт за период {_fmt_date(period_start)} - {_fmt_date(period_end)}",
        "",
        f"Активных проектов: {projects.count()}",
        f"Всего задач: {items.count()}",
        f"Закрытых задач: {items.filter(status__is_closed=True).count()}",
        "",
        "Проекты и задачи за отчётный период:",
    ]
    for project in projects:
        project_items = items.filter(project_id=project.id)
        active_item_ids = set(
            project_items.filter(
                Q(created_at__range=(period_start_dt, period_end_dt))
                | Q(updated_at__range=(period_start_dt, period_end_dt))
            ).values_list("id", flat=True)
        )
        active_item_ids.update(
            WorkItemStatusHistory.objects.filter(
                work_item__project_id=project.id,
                changed_at__range=(period_start_dt, period_end_dt),
            ).values_list("work_item_id", flat=True)
        )
        active_item_ids.update(
            Comment.objects.filter(
                work_item__project_id=project.id,
                created_at__range=(period_start_dt, period_end_dt),
            ).values_list("work_item_id", flat=True)
        )
        status_changes = (
            WorkItemStatusHistory.objects.filter(
                work_item__project_id=project.id,
                changed_at__range=(period_start_dt, period_end_dt),
            )
            .values("work_item_id")
            .annotate(last_changed_at=Max("changed_at"))
        )
        status_changes_map = {
            row["work_item_id"]: row["last_changed_at"] for row in status_changes
        }
        period_items = list(project_items.filter(id__in=active_item_ids))
        period_items.sort(
            key=lambda wi: (
                status_changes_map.get(wi.id) or wi.updated_at or wi.created_at
            )
        )
        completed_in_period_ids = set(
            WorkItemStatusHistory.objects.filter(
                work_item__project_id=project.id,
                to_status__is_closed=True,
                changed_at__range=(period_start_dt, period_end_dt),
            ).values_list("work_item_id", flat=True)
        )

        if not period_items:
            continue

        lines.append(f"Проект: {project.name}")
        lines.append(
            f"Итого за период: задач в работе — {len(period_items)}, "
            f"выполнено — {len(completed_in_period_ids)}"
        )
        lines.append("Задачи:")

        for wi in period_items:
            status_note = latest_comment_map.get(wi.id)
            status_note_text = (
                (status_note.body or "").strip()
                if status_note
                else ""
            ) or "—"
            status_note_time = (
                _fmt_date(status_note.created_at)
                if status_note
                else "—"
            )
            lines.append(
                "  • "
                f"{wi.title} | "
                f"Статус: {status_note_text} | "
                f"Дата статуса: {status_note_time} | "
                f"Исполнитель: {_fmt_person(wi.assignee)} | "
                f"Срок: {_fmt_date(wi.due_date)}"
            )
        lines.append("")
    return "\n".join(lines)


class CabinetSerializer(serializers.ModelSerializer):
    """Профиль для отображения и самообслуживания."""

    short_fio = serializers.SerializerMethodField()
    directorate_detail = DirectorateBriefSerializer(
        source="directorate", read_only=True
    )
    subdivision_detail = DirectorateSubdivisionBriefSerializer(
        source="subdivision", read_only=True
    )
    subdivision_id = serializers.PrimaryKeyRelatedField(
        queryset=DirectorateSubdivision.objects.filter(is_active=True),
        source="subdivision",
        write_only=True,
        allow_null=True,
        required=False,
    )
    theme_detail = serializers.SerializerMethodField()
    preferred_theme_detail = serializers.SerializerMethodField()
    theme_id = serializers.PrimaryKeyRelatedField(
        queryset=Theme.objects.filter(is_active=True),
        source="preferred_theme",
        write_only=True,
        allow_null=True,
        required=False,
    )

    def get_short_fio(self, obj: User):
        return obj.short_fio()

    def validate_theme_id(self, theme):
        return theme

    def validate_subdivision_id(self, subdivision):
        if subdivision is None:
            return subdivision
        current_dir_id = getattr(self.instance, "directorate_id", None) if self.instance else None
        if not current_dir_id:
            raise serializers.ValidationError("Сначала должна быть назначена дирекция.")
        if subdivision.directorate_id != current_dir_id:
            raise serializers.ValidationError(
                "Можно выбрать только группу/отдел своей дирекции."
            )
        return subdivision

    def get_theme_detail(self, obj: User):
        return theme_detail_for_user(obj)

    def get_preferred_theme_detail(self, obj: User):
        pt = getattr(obj, "preferred_theme", None)
        return ThemeBriefSerializer(pt).data if pt else None

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "patronymic",
            "directorate_detail",
            "subdivision_detail",
            "subdivision_id",
            "job_title",
            "theme_detail",
            "preferred_theme_detail",
            "theme_id",
            "short_fio",
            "is_staff",
            "is_superuser",
        )
        read_only_fields = ("id", "username", "short_fio", "is_staff", "is_superuser")


class AdminUserSerializer(serializers.ModelSerializer):
    """Полное редактирование пользователя — только админы."""

    short_fio = serializers.SerializerMethodField()
    directorate_detail = DirectorateBriefSerializer(
        source="directorate", read_only=True
    )
    directorate_id = serializers.PrimaryKeyRelatedField(
        queryset=Directorate.objects.all(),
        source="directorate",
        write_only=True,
        allow_null=True,
        required=False,
    )
    subdivision_detail = DirectorateSubdivisionBriefSerializer(
        source="subdivision", read_only=True
    )
    subdivision_id = serializers.PrimaryKeyRelatedField(
        queryset=DirectorateSubdivision.objects.all(),
        source="subdivision",
        write_only=True,
        allow_null=True,
        required=False,
    )
    theme_detail = serializers.SerializerMethodField()
    preferred_theme_detail = serializers.SerializerMethodField()
    theme_id = serializers.PrimaryKeyRelatedField(
        queryset=Theme.objects.all(),
        source="preferred_theme",
        write_only=True,
        allow_null=True,
        required=False,
    )

    def get_short_fio(self, obj: User):
        return obj.short_fio()

    def get_theme_detail(self, obj: User):
        return theme_detail_for_user(obj)

    def get_preferred_theme_detail(self, obj: User):
        pt = getattr(obj, "preferred_theme", None)
        return ThemeBriefSerializer(pt).data if pt else None

    def validate(self, attrs):
        attrs = super().validate(attrs)
        subdivision = attrs.get("subdivision", getattr(self.instance, "subdivision", None))
        directorate = attrs.get("directorate", getattr(self.instance, "directorate", None))
        if "directorate" in attrs and "subdivision" not in attrs and subdivision is not None:
            if directorate is None or subdivision.directorate_id != directorate.id:
                attrs["subdivision"] = None
                return attrs
        if subdivision is None:
            return attrs
        if directorate is None:
            raise serializers.ValidationError(
                {"subdivision_id": "Нельзя выбрать группу/отдел без дирекции."}
            )
        if subdivision.directorate_id != directorate.id:
            raise serializers.ValidationError(
                {
                    "subdivision_id": (
                        "Группа/отдел должен принадлежать выбранной дирекции."
                    )
                }
            )
        return attrs

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "patronymic",
            "directorate_detail",
            "directorate_id",
            "subdivision_detail",
            "subdivision_id",
            "job_title",
            "theme_detail",
            "preferred_theme_detail",
            "theme_id",
            "is_active",
            "is_staff",
            "is_superuser",
            "short_fio",
        )
        read_only_fields = ("id", "short_fio")


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(CabinetSerializer(request.user).data)

    def patch(self, request):
        sz = CabinetSerializer(request.user, data=request.data, partial=True)
        sz.is_valid(raise_exception=True)
        sz.save()
        return Response(CabinetSerializer(request.user).data)


class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("last_name", "first_name", "username")
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    http_method_names = ["get", "patch", "head", "options"]

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        if user.is_superuser and not request.user.is_superuser:
            return Response(
                {"detail": "Редактирование главного администратора запрещено."},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Контроль назначения дирекции/подразделения:
        # - суперпользователь может всё;
        # - обычный staff может назначать только свою дирекцию и её подразделения.
        data = request.data
        if not request.user.is_superuser:
            # Проверка дирекции
            if "directorate_id" in data:
                new_dir = data.get("directorate_id")
                if new_dir not in ("", None):
                    try:
                        new_dir_id = int(new_dir)
                    except (TypeError, ValueError):
                        new_dir_id = None
                    if new_dir_id and request.user.directorate_id != new_dir_id:
                        return Response(
                            {
                                "detail": (
                                    "Можно назначать дирекцию только свою. "
                                    "Обратитесь к суперпользователю для переноса в другую дирекцию."
                                )
                            },
                            status=status.HTTP_403_FORBIDDEN,
                        )
        return super().partial_update(request, *args, **kwargs)


class DirectorateRecruitSerializer(serializers.ModelSerializer):
    """Кандидат на добавление в дирекцию (у кого пока нет дирекции)."""

    short_fio = serializers.SerializerMethodField()
    directorate_detail = DirectorateBriefSerializer(source="directorate", read_only=True)
    subdivision_detail = DirectorateSubdivisionBriefSerializer(
        source="subdivision", read_only=True
    )
    subdivision_id = serializers.PrimaryKeyRelatedField(
        queryset=DirectorateSubdivision.objects.filter(is_active=True),
        source="subdivision",
        write_only=True,
        allow_null=True,
        required=False,
    )

    def get_short_fio(self, obj: User) -> str:
        return obj.short_fio()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "patronymic",
            "short_fio",
            "job_title",
            "subdivision_detail",
            "subdivision_id",
            "directorate_detail",
        )
        read_only_fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "patronymic",
            "short_fio",
            "job_title",
            "subdivision_detail",
            "directorate_detail",
        )


class DirectorateRecruitViewSet(
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    Добавление новых участников в свою дирекцию.
    Доступно любому участнику с назначенной дирекцией.
    """

    serializer_class = DirectorateRecruitSerializer
    permission_classes = [IsAuthenticated, HasDirectorate]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        qs = (
            User.objects.filter(is_active=True, directorate__isnull=True)
            .order_by("last_name", "first_name", "username")
            .select_related("directorate", "subdivision")
        )
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(username__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
                | Q(patronymic__icontains=q)
            )
        return qs

    def partial_update(self, request, *args, **kwargs):
        target = self.get_object()
        if target.directorate_id:
            return Response(
                {"detail": "Пользователь уже состоит в дирекции."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sub_id = request.data.get("subdivision_id")
        subdivision = None
        if sub_id not in ("", None):
            try:
                sub_id_int = int(sub_id)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "Некорректный subdivision_id."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            subdivision = DirectorateSubdivision.objects.filter(
                pk=sub_id_int,
                is_active=True,
                directorate_id=request.user.directorate_id,
            ).first()
            if subdivision is None:
                return Response(
                    {
                        "detail": (
                            "Можно выбрать только группу/отдел своей дирекции."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        target.directorate_id = request.user.directorate_id
        target.subdivision = subdivision
        target.save(update_fields=["directorate", "subdivision"])
        return Response(DirectorateRecruitSerializer(target).data)


class UserDirectoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Справочник пользователей для выбора исполнителей/наблюдателей."""

    serializer_class = UserBriefSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        qs = User.objects.filter(is_active=True).order_by("last_name", "first_name", "username")
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(username__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
                | Q(patronymic__icontains=q)
            )
        return qs


class DirectorateMemberSerializer(serializers.ModelSerializer):
    short_fio = serializers.SerializerMethodField()
    subdivision_detail = DirectorateSubdivisionBriefSerializer(
        source="subdivision", read_only=True
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "short_fio",
            "job_title",
            "subdivision_detail",
        )

    def get_short_fio(self, obj: User) -> str:
        return obj.short_fio()


class DirectorateWeeklyReportSerializer(serializers.ModelSerializer):
    author_short_fio = serializers.SerializerMethodField()

    class Meta:
        model = DirectorateWeeklyReport
        fields = (
            "id",
            "title",
            "period_start",
            "period_end",
            "summary",
            "created_at",
            "author_short_fio",
        )
        read_only_fields = ("id", "created_at", "author_short_fio")

    def get_author_short_fio(self, obj: DirectorateWeeklyReport) -> str:
        return obj.author.short_fio()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs["period_end"] < attrs["period_start"]:
            raise serializers.ValidationError(
                {"period_end": "Дата конца периода не может быть раньше начала."}
            )
        return attrs


class DirectorateMembersView(APIView):
    permission_classes = [IsAuthenticated, HasDirectorate]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        qs = User.objects.filter(
            is_active=True,
            directorate_id=request.user.directorate_id,
        ).select_related("subdivision")
        if q:
            qs = qs.filter(
                Q(username__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
                | Q(patronymic__icontains=q)
            )
        qs = qs.order_by("last_name", "first_name", "username")
        return Response(DirectorateMemberSerializer(qs, many=True).data)


class DirectorateProjectAnalyticsView(APIView):
    permission_classes = [IsAuthenticated, HasDirectorate]

    def get(self, request):
        directorate_id = request.user.directorate_id
        members_qs = User.objects.filter(
            is_active=True,
            directorate_id=directorate_id,
        ).select_related("subdivision")
        member_ids = list(members_qs.values_list("id", flat=True))
        if not member_ids:
            return Response({"totals": {}, "projects": [], "subdivisions": []})
        projects = (
            Project.objects.filter(
                memberships__user_id__in=member_ids,
                analytics_enabled=True,
            )
            .distinct()
            .order_by("name")
        )
        project_ids = list(projects.values_list("id", flat=True))
        items = WorkItem.objects.filter(project_id__in=project_ids)
        counts_by_project = {}
        for row in items.values("project_id").annotate(total=Count("id")):
            counts_by_project[row["project_id"]] = {"total_tasks": row["total"]}
        for row in (
            items.filter(status__is_closed=True)
            .values("project_id")
            .annotate(total=Count("id"))
        ):
            counts_by_project.setdefault(row["project_id"], {})[
                "closed_tasks"
            ] = row["total"]

        member_counts = dict(
            ProjectMembership.objects.filter(project_id__in=project_ids)
            .values("project_id")
            .annotate(total=Count("id"))
            .values_list("project_id", "total")
        )
        latest_comments = (
            Comment.objects.filter(work_item__project_id__in=project_ids)
            .select_related("author")
            .order_by("work_item_id", "-created_at", "-id")
        )
        latest_comment_map: dict[int, Comment] = {}
        for comment in latest_comments:
            if comment.work_item_id not in latest_comment_map:
                latest_comment_map[comment.work_item_id] = comment
        project_tasks_map: dict[int, list[dict]] = {}
        for wi in (
            items.select_related("status", "assignee")
            .order_by("status__position", "due_date", "id")
        ):
            latest_note = latest_comment_map.get(wi.id)
            project_tasks_map.setdefault(wi.project_id, []).append(
                {
                    "id": wi.id,
                    "title": wi.title,
                    "status_note_text": (
                        (latest_note.body or "").strip()
                        if latest_note
                        else ""
                    ) or "—",
                    "status_note_created_at": (
                        latest_note.created_at if latest_note else None
                    ),
                    "assignee_name": (
                        wi.assignee.short_fio() or wi.assignee.username
                        if wi.assignee
                        else "—"
                    ),
                    "due_date": wi.due_date,
                }
            )

        payload = []
        for p in projects:
            c = counts_by_project.get(p.id, {})
            payload.append(
                {
                    "project_id": p.id,
                    "project_name": p.name,
                    "members_count": member_counts.get(p.id, 0),
                    "total_tasks": c.get("total_tasks", 0),
                    "closed_tasks": c.get("closed_tasks", 0),
                    "tasks": project_tasks_map.get(p.id, []),
                }
            )
        subdivision_rows = []
        subdivisions = DirectorateSubdivision.objects.filter(
            directorate_id=directorate_id,
            is_active=True,
        ).order_by("sort_order", "name")
        for sub in subdivisions:
            sub_members = members_qs.filter(subdivision_id=sub.id)
            sub_member_ids = list(sub_members.values_list("id", flat=True))
            sub_items = WorkItem.objects.filter(
                project_id__in=project_ids,
                assignee_id__in=sub_member_ids,
            )
            subdivision_rows.append(
                {
                    "id": sub.id,
                    "name": sub.name,
                    "kind_label": sub.get_kind_display(),
                    "members_count": len(sub_member_ids),
                    "assigned_tasks": sub_items.count(),
                    "closed_tasks": sub_items.filter(status__is_closed=True).count(),
                }
            )

        no_sub_ids = list(
            members_qs.filter(subdivision__isnull=True).values_list("id", flat=True)
        )
        no_sub_items = WorkItem.objects.filter(
            project_id__in=project_ids,
            assignee_id__in=no_sub_ids,
        )
        if no_sub_ids:
            subdivision_rows.append(
                {
                    "id": 0,
                    "name": "Без подразделения",
                    "kind_label": "Сотрудники",
                    "members_count": len(no_sub_ids),
                    "assigned_tasks": no_sub_items.count(),
                    "closed_tasks": no_sub_items.filter(status__is_closed=True).count(),
                }
            )

        totals = {
            "members_count": len(member_ids),
            "projects_count": len(project_ids),
            "tasks_count": items.count(),
            "closed_tasks": items.filter(status__is_closed=True).count(),
        }

        return Response(
            {
                "totals": totals,
                "projects": payload,
                "subdivisions": subdivision_rows,
            }
        )


class DirectorateWeeklyReportListCreateView(APIView):
    permission_classes = [IsAuthenticated, HasDirectorate]

    def get(self, request):
        qs = DirectorateWeeklyReport.objects.filter(
            directorate_id=request.user.directorate_id
        ).select_related("author")
        for report in qs:
            report.summary = build_directorate_report_summary(
                directorate_id=request.user.directorate_id,
                period_start=report.period_start,
                period_end=report.period_end,
            )
            report.save(update_fields=["summary"])
        return Response(DirectorateWeeklyReportSerializer(qs, many=True).data)

    def post(self, request):
        sz = DirectorateWeeklyReportSerializer(data=request.data)
        sz.is_valid(raise_exception=True)
        generated_summary = build_directorate_report_summary(
            directorate_id=request.user.directorate_id,
            period_start=sz.validated_data["period_start"],
            period_end=sz.validated_data["period_end"],
        )
        obj = sz.save(
            directorate_id=request.user.directorate_id,
            author=request.user,
            summary=generated_summary,
        )
        return Response(
            DirectorateWeeklyReportSerializer(obj).data,
            status=status.HTTP_201_CREATED,
        )


class DirectorateWeeklyReportDetailView(APIView):
    permission_classes = [IsAuthenticated, HasDirectorate]

    def delete(self, request, report_id: int):
        report = DirectorateWeeklyReport.objects.filter(
            id=report_id,
            directorate_id=request.user.directorate_id,
        ).first()
        if report is None:
            return Response({"detail": "Отчёт не найден."}, status=status.HTTP_404_NOT_FOUND)
        report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
