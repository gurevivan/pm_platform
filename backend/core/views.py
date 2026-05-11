"""ViewSets и вложенные маршруты."""

from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from .filters import WorkItemFilter
from .models import (
    Board,
    Comment,
    Directorate,
    DirectorateChatMessage,
    DirectorateSubdivision,
    DirectorateSubdivisionChatMessage,
    Project,
    ProjectChatMessage,
    ProjectMembership,
    Status,
    WorkItemType,
    WorkItem,
    WorkItemAttachment,
    WorkItemStatusHistory,
    Theme,
    WorkItemRelation,
)
from .permissions import (
    HasDirectorate,
    HasSubdivision,
    IsProjectContributor,
    IsProjectManager,
    IsProjectViewer,
    membership_role,
)
from .serializers import (
    BoardSerializer,
    CommentSerializer,
    DirectorateBriefSerializer,
    DirectorateChatMessageSerializer,
    DirectorateSubdivisionBriefSerializer,
    DirectorateSubdivisionChatMessageSerializer,
    MembershipSerializer,
    ProjectChatMessageSerializer,
    ProjectCreateSerializer,
    ProjectSerializer,
    StatusSerializer,
    WorkItemRelationSerializer,
    WorkItemAttachmentSerializer,
    WorkItemTypeSerializer,
    WorkItemStatusHistorySerializer,
    ThemeBriefSerializer,
    ThemeStaffSerializer,
    WorkItemReorderSerializer,
    WorkItemSerializer,
)


class DirectorateViewSet(viewsets.ModelViewSet):
    """Список дирекций; создавать/править может только суперпользователь."""

    serializer_class = DirectorateBriefSerializer
    queryset = Directorate.objects.all().order_by("sort_order", "name")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]

    def get_queryset(self):
        qs = super().get_queryset()
        if not (self.request.user.is_authenticated and self.request.user.is_staff):
            qs = qs.filter(is_active=True)
        return qs

    def _require_superuser(self):
        if not self.request.user.is_superuser:
            raise PermissionDenied("Создавать и менять дирекции может только суперпользователь.")

    def perform_create(self, serializer):
        self._require_superuser()
        serializer.save()

    def perform_update(self, serializer):
        self._require_superuser()
        serializer.save()

    def perform_destroy(self, instance):
        self._require_superuser()
        instance.delete()


class DirectorateSubdivisionViewSet(viewsets.ModelViewSet):
    """Группы/отделы дирекций: чтение для всех авторизованных, CRUD для staff."""

    queryset = DirectorateSubdivision.objects.select_related("directorate").order_by(
        "directorate__sort_order", "sort_order", "kind", "name"
    )

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]

    def get_serializer_class(self):
        return DirectorateSubdivisionBriefSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        directorate_id = self.request.query_params.get("directorate_id")
        if directorate_id and directorate_id.isdigit():
            qs = qs.filter(directorate_id=int(directorate_id))
        if not (user.is_authenticated and user.is_staff):
            qs = qs.filter(is_active=True)
        return qs


class ThemeViewSet(viewsets.ModelViewSet):
    """Темы: просмотр активных для всех; создание и правка — только staff (как /admin/users/)."""

    queryset = Theme.objects.all().order_by("sort_order", "slug")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminUser()]

    def get_serializer_class(self):
        user = self.request.user
        if user.is_authenticated and user.is_staff:
            return ThemeStaffSerializer
        return ThemeBriefSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if not (self.request.user.is_authenticated and self.request.user.is_staff):
            qs = qs.filter(is_active=True)
        return qs


class WorkItemTypeViewSet(viewsets.ModelViewSet):
    serializer_class = WorkItemTypeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = WorkItemType.objects.all().order_by("sort_order", "name")
        if not (self.request.user.is_authenticated and self.request.user.is_staff):
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]

    def _require_superuser(self):
        if not self.request.user.is_superuser:
            raise PermissionDenied("Создавать и менять типы задач может только суперпользователь.")

    def perform_create(self, serializer):
        self._require_superuser()
        serializer.save()

    def perform_update(self, serializer):
        self._require_superuser()
        serializer.save()

    def perform_destroy(self, instance):
        self._require_superuser()
        instance.delete()


class MyTasksViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = WorkItemSerializer
    permission_classes = [IsAuthenticated]
    ordering_fields = ("created_at", "due_date", "updated_at", "id")

    def get_queryset(self):
        history_qs = WorkItemStatusHistory.objects.order_by("-changed_at", "-id")
        return (
            WorkItem.objects.filter(
                Q(assignee=self.request.user)
                | Q(
                    project__memberships__user=self.request.user,
                    project__memberships__role=ProjectMembership.Role.VIEWER,
                )
            )
            .select_related("project", "assignee", "author", "status")
            .prefetch_related(
                Prefetch(
                    "status_history",
                    queryset=history_qs,
                    to_attr="status_history_cache",
                )
            )
            .distinct()
            .order_by("-updated_at", "-id")
        )


class DirectorateChatMessageViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Общий чат сотрудников дирекции.
    Доступен только если в профиле указана активная дирекция.
    """

    permission_classes = [IsAuthenticated, HasDirectorate]
    serializer_class = DirectorateChatMessageSerializer

    def get_queryset(self):
        return DirectorateChatMessage.objects.filter(
            directorate_id=self.request.user.directorate_id,
        ).order_by("created_at")

    def perform_create(self, serializer):
        serializer.save(
            directorate_id=self.request.user.directorate_id,
            author=self.request.user,
        )

    def perform_update(self, serializer):
        if serializer.instance.author_id != self.request.user.id:
            raise PermissionDenied("Можно редактировать только свои сообщения")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.author_id != self.request.user.id:
            raise PermissionDenied("Можно удалять только свои сообщения")
        instance.delete()


class DirectorateSubdivisionChatMessageViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Чат группы/отдела в составе дирекции."""

    permission_classes = [IsAuthenticated, HasSubdivision]
    serializer_class = DirectorateSubdivisionChatMessageSerializer

    def get_queryset(self):
        return DirectorateSubdivisionChatMessage.objects.filter(
            subdivision_id=self.request.user.subdivision_id,
        ).select_related("subdivision", "author").order_by("created_at")

    def perform_create(self, serializer):
        serializer.save(
            subdivision_id=self.request.user.subdivision_id,
            author=self.request.user,
        )

    def perform_update(self, serializer):
        if serializer.instance.author_id != self.request.user.id:
            raise PermissionDenied("Можно редактировать только свои сообщения")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.author_id != self.request.user.id:
            raise PermissionDenied("Можно удалять только свои сообщения")
        instance.delete()


class NestedProjectAccessMixin:
    """Проверка членства в проекте по project_pk из URL."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        pk = self.kwargs.get("project_pk")
        if pk is None or not request.user.is_authenticated:
            return
        if not ProjectMembership.objects.filter(
            project_id=pk, user=request.user
        ).exists():
            raise PermissionDenied("Нет доступа к проекту")


class ProjectChatMessageViewSet(
    NestedProjectAccessMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Общий чат участников проекта (все с доступом к проекту, включая viewer).
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ProjectChatMessageSerializer

    def get_queryset(self):
        return ProjectChatMessage.objects.filter(
            project_id=self.kwargs["project_pk"],
        ).order_by("created_at")

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs["project_pk"])
        serializer.save(project=project, author=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.author_id != self.request.user.id:
            raise PermissionDenied("Можно редактировать только свои сообщения")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.author_id != self.request.user.id:
            raise PermissionDenied("Можно удалять только свои сообщения")
        instance.delete()


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        read = ProjectSerializer(
            serializer.instance, context={"request": request}
        )
        headers = self.get_success_headers(read.data)
        return Response(read.data, status=201, headers=headers)

    def get_queryset(self):
        return (
            Project.objects.filter(memberships__user=self.request.user)
            .distinct()
            .order_by("name")
        )

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated()]
        if self.action in ("retrieve", "list"):
            return [IsAuthenticated(), IsProjectViewer()]
        return [IsAuthenticated(), IsProjectManager()]

    def get_serializer_class(self):
        if self.action == "create":
            return ProjectCreateSerializer
        return ProjectSerializer

    def perform_create(self, serializer):
        project = serializer.save()
        membership, _ = ProjectMembership.objects.get_or_create(
            user=self.request.user,
            project=project,
            defaults={"role": ProjectMembership.Role.ADMIN},
        )
        if membership.role != ProjectMembership.Role.ADMIN:
            membership.role = ProjectMembership.Role.ADMIN
            membership.save(update_fields=["role"])


class MembershipViewSet(NestedProjectAccessMixin, viewsets.ModelViewSet):
    serializer_class = MembershipSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ProjectMembership.objects.filter(
            project_id=self.kwargs["project_pk"]
        )

    def _require_manager(self) -> None:
        pid = int(self.kwargs["project_pk"])
        r = membership_role(pid, self.request.user)
        if r not in (
            ProjectMembership.Role.MANAGER,
            ProjectMembership.Role.ADMIN,
        ):
            raise PermissionDenied("Нужны права менеджера или админа проекта")

    def perform_create(self, serializer):
        self._require_manager()
        project = get_object_or_404(Project, pk=self.kwargs["project_pk"])
        serializer.save(project=project)

    def perform_update(self, serializer):
        self._require_manager()
        serializer.save()

    def perform_destroy(self, instance):
        self._require_manager()
        instance.delete()

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated()]


class StatusViewSet(NestedProjectAccessMixin, viewsets.ModelViewSet):
    serializer_class = StatusSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Status.objects.filter(project_id=self.kwargs["project_pk"])

    def _require_manager(self) -> None:
        pid = int(self.kwargs["project_pk"])
        r = membership_role(pid, self.request.user)
        if r not in (
            ProjectMembership.Role.MANAGER,
            ProjectMembership.Role.ADMIN,
        ):
            raise PermissionDenied()

    def perform_create(self, serializer):
        self._require_manager()
        serializer.save(project_id=self.kwargs["project_pk"])

    def perform_update(self, serializer):
        self._require_manager()
        serializer.save()

    def perform_destroy(self, instance):
        self._require_manager()
        if WorkItem.objects.filter(status=instance).exists():
            raise ValidationError(
                "Нельзя удалить статус с задачами"
            )
        instance.delete()

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated()]


class BoardViewSet(NestedProjectAccessMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = BoardSerializer
    permission_classes = [IsAuthenticated, IsProjectViewer]

    def get_queryset(self):
        return (
            Board.objects.filter(project_id=self.kwargs["project_pk"])
            .prefetch_related("columns__status")
            .order_by("-is_default", "name")
        )


class WorkItemViewSet(NestedProjectAccessMixin, viewsets.ModelViewSet):
    serializer_class = WorkItemSerializer
    permission_classes = [IsAuthenticated, IsProjectViewer]
    filterset_class = WorkItemFilter
    search_fields = ("title", "description")
    ordering_fields = ("created_at", "due_date", "position", "id")

    def get_queryset(self):
        history_qs = WorkItemStatusHistory.objects.order_by("-changed_at", "-id")
        qs = WorkItem.objects.filter(
            project_id=self.kwargs["project_pk"]
        ).select_related("assignee", "author", "status").prefetch_related(
            Prefetch(
                "status_history",
                queryset=history_qs,
                to_attr="status_history_cache",
            )
        )
        if self.action in ("partial_update", "update", "destroy"):
            pass
        return qs

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), IsProjectViewer()]
        return [IsAuthenticated(), IsProjectContributor()]

    def perform_create(self, serializer):
        project = get_object_or_404(
            Project.objects.filter(
                memberships__user=self.request.user
            ).distinct(),
            pk=self.kwargs["project_pk"],
        )
        status_obj = serializer.validated_data.get("status")
        if status_obj and status_obj.project_id != project.id:
            raise ValidationError("Статус из другого проекта")
        create_data = {}
        if "weekly_report_enabled" not in self.request.data:
            create_data["weekly_report_enabled"] = project.weekly_report_enabled
        if "analytics_enabled" not in self.request.data:
            create_data["analytics_enabled"] = project.analytics_enabled
        work_item = serializer.save(
            project=project,
            author=self.request.user,
            **create_data,
        )
        WorkItemStatusHistory.objects.create(
            work_item=work_item,
            from_status=None,
            to_status=work_item.status,
            changed_by=self.request.user,
        )

    def perform_update(self, serializer):
        prev_status = serializer.instance.status
        status_obj = serializer.validated_data.get("status")
        if status_obj and status_obj.project_id != int(
            self.kwargs["project_pk"]
        ):
            raise ValidationError("Статус из другого проекта")
        work_item = serializer.save()
        if status_obj:
            prev_status_id = getattr(prev_status, "id", None)
            if prev_status_id != status_obj.id:
                WorkItemStatusHistory.objects.create(
                    work_item=work_item,
                    from_status=prev_status,
                    to_status=status_obj,
                    changed_by=self.request.user,
                )

    @action(detail=True, methods=["patch"], url_path="reorder")
    def reorder(self, request, project_pk=None, pk=None):
        """Канбан: смена колонки и порядка."""
        work_item = get_object_or_404(
            WorkItem,
            pk=pk,
            project_id=project_pk,
        )
        self.check_object_permissions(request, work_item)
        sz = WorkItemReorderSerializer(data=request.data)
        sz.is_valid(raise_exception=True)
        new_status = sz.validated_data["status"]
        if new_status.project_id != int(project_pk):
            raise ValidationError("Статус из другого проекта")
        prev_status = work_item.status
        work_item.status = new_status
        work_item.position = sz.validated_data["position"]
        prev_status_id = getattr(prev_status, "id", None)
        if work_item.start_date is None and prev_status_id != new_status.id:
            # Старт фиксируем от факта первого движения карточки в канбане.
            work_item.start_date = timezone.localdate()
        update_fields = ["status", "position", "updated_at"]
        if work_item.start_date is not None:
            update_fields.append("start_date")
        work_item.save(update_fields=update_fields)
        if getattr(prev_status, "id", None) != new_status.id:
            WorkItemStatusHistory.objects.create(
                work_item=work_item,
                from_status=prev_status,
                to_status=new_status,
                changed_by=request.user,
            )
        return Response(WorkItemSerializer(work_item).data)


class WorkItemNestedAccessMixin(NestedProjectAccessMixin):
    """Доступ к work_item внутри project."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        wpk = self.kwargs.get("work_item_pk")
        ppk = self.kwargs.get("project_pk")
        if wpk is None or ppk is None:
            return
        if not WorkItem.objects.filter(
            pk=wpk, project_id=ppk
        ).exists():
            raise PermissionDenied("Задача не найдена в проекте")


class CommentViewSet(WorkItemNestedAccessMixin, viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Comment.objects.filter(
            work_item_id=self.kwargs["work_item_pk"],
            work_item__project_id=self.kwargs["project_pk"],
        )

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), IsProjectViewer()]
        return [IsAuthenticated(), IsProjectContributor()]

    def perform_create(self, serializer):
        wi = get_object_or_404(
            WorkItem,
            pk=self.kwargs["work_item_pk"],
            project_id=self.kwargs["project_pk"],
        )
        self.check_object_permissions(self.request, wi)
        serializer.save(work_item=wi, author=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.author_id != self.request.user.id:
            raise PermissionDenied("Только автор может править комментарий")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.author_id != self.request.user.id:
            raise PermissionDenied()
        instance.delete()


class WorkItemStatusHistoryViewSet(
    WorkItemNestedAccessMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = WorkItemStatusHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WorkItemStatusHistory.objects.filter(
            work_item_id=self.kwargs["work_item_pk"],
            work_item__project_id=self.kwargs["project_pk"],
        ).select_related("from_status", "to_status", "changed_by")

    def get_permissions(self):
        return [IsAuthenticated(), IsProjectViewer()]


class WorkItemAttachmentViewSet(WorkItemNestedAccessMixin, viewsets.ModelViewSet):
    serializer_class = WorkItemAttachmentSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WorkItemAttachment.objects.filter(
            work_item_id=self.kwargs["work_item_pk"],
            work_item__project_id=self.kwargs["project_pk"],
        ).select_related("uploaded_by")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), IsProjectViewer()]
        return [IsAuthenticated(), IsProjectContributor()]

    def perform_create(self, serializer):
        work_item = get_object_or_404(
            WorkItem.objects.filter(project_id=self.kwargs["project_pk"]),
            pk=self.kwargs["work_item_pk"],
        )
        self.check_object_permissions(self.request, work_item)
        serializer.save(work_item=work_item, uploaded_by=self.request.user)


class WorkItemRelationViewSet(NestedProjectAccessMixin, viewsets.ModelViewSet):
    serializer_class = WorkItemRelationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WorkItemRelation.objects.filter(
            from_item__project_id=self.kwargs["project_pk"]
        ).select_related("from_item", "to_item")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), IsProjectViewer()]
        return [IsAuthenticated(), IsProjectContributor()]

    def perform_create(self, serializer):
        frm: WorkItem = serializer.validated_data["from_item"]
        if frm.project_id != int(self.kwargs["project_pk"]):
            raise ValidationError("Задача не из этого проекта")
        self.check_object_permissions(self.request, frm)
        serializer.save()
