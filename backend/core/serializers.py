"""Сериализаторы DRF."""

from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import serializers
from urllib.parse import unquote

from .models import (
    Board,
    BoardColumn,
    Comment,
    Directorate,
    DirectorateChatMessage,
    DirectorateSubdivision,
    DirectorateSubdivisionChatMessage,
    Project,
    ProjectChatMessage,
    ProjectMembership,
    Status,
    Theme,
    WorkItemAttachment,
    WorkItemType,
    WorkItem,
    WorkItemStatusHistory,
    WorkItemRelation,
)

User = get_user_model()


def _normalize_filename(raw_name: str) -> str:
    """Пытается исправить mojibake в имени файла и вернуть читаемое имя."""
    name = (raw_name or "").strip()
    if not name:
        return name
    name = unquote(name)
    try:
        fixed = name.encode("latin1").decode("utf-8")
        if fixed:
            return fixed
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass
    return name


def _attachment_basename(obj, field_name: str = "attachment") -> str | None:
    f = getattr(obj, field_name, None)
    if not f:
        return None
    basename = f.name.split("/")[-1]
    return _normalize_filename(basename)


class DirectorateBriefSerializer(serializers.ModelSerializer):
    """Краткая запись дирекции для задач и карточек пользователя."""

    class Meta:
        model = Directorate
        fields = ("id", "name")


class DirectorateSubdivisionBriefSerializer(serializers.ModelSerializer):
    """Краткая запись группы/отдела дирекции."""

    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    directorate_detail = DirectorateBriefSerializer(source="directorate", read_only=True)

    class Meta:
        model = DirectorateSubdivision
        fields = ("id", "name", "kind", "kind_label", "directorate", "directorate_detail")


class DirectorateChatMessageSerializer(serializers.ModelSerializer):
    """Сообщение чата дирекции: только чтение и создание через API."""

    author_username = serializers.CharField(source="author.username", read_only=True)
    author_short_fio = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()
    attachment_name = serializers.SerializerMethodField()

    class Meta:
        model = DirectorateChatMessage
        fields = (
            "id",
            "body",
            "attachment",
            "attachment_url",
            "attachment_name",
            "created_at",
            "author_username",
            "author_short_fio",
        )
        read_only_fields = (
            "id",
            "created_at",
            "author_username",
            "author_short_fio",
            "attachment_url",
            "attachment_name",
        )

    def get_author_short_fio(self, obj) -> str:
        return obj.author.short_fio()

    def get_attachment_url(self, obj) -> str | None:
        f = getattr(obj, "attachment", None)
        if not f:
            return None
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri(f.url)
        return f.url

    def get_attachment_name(self, obj) -> str | None:
        return _attachment_basename(obj)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        text = (attrs.get("body") or "").strip()
        file_obj = attrs.get("attachment")
        if file_obj is not None:
            file_obj.name = _normalize_filename(file_obj.name)
        if not text and not file_obj:
            raise serializers.ValidationError(
                {"body": "Нужно написать сообщение или прикрепить файл."}
            )
        if text and len(text) > 4000:
            raise serializers.ValidationError({"body": "Не более 4000 символов."})
        attrs["body"] = text
        return attrs


class DirectorateSubdivisionChatMessageSerializer(serializers.ModelSerializer):
    """Сообщение чата группы/отдела."""

    author_username = serializers.CharField(source="author.username", read_only=True)
    author_short_fio = serializers.SerializerMethodField()
    subdivision_detail = DirectorateSubdivisionBriefSerializer(
        source="subdivision", read_only=True
    )

    class Meta:
        model = DirectorateSubdivisionChatMessage
        fields = (
            "id",
            "body",
            "created_at",
            "author_username",
            "author_short_fio",
            "subdivision_detail",
        )
        read_only_fields = (
            "id",
            "created_at",
            "author_username",
            "author_short_fio",
            "subdivision_detail",
        )

    def get_author_short_fio(self, obj) -> str:
        return obj.author.short_fio()

    def validate_body(self, value: str) -> str:
        text = (value or "").strip()
        if not text:
            raise serializers.ValidationError("Текст сообщения не может быть пустым.")
        if len(text) > 4000:
            raise serializers.ValidationError("Не более 4000 символов.")
        return text


class ProjectChatMessageSerializer(serializers.ModelSerializer):
    """Сообщение чата проекта."""

    author_username = serializers.CharField(source="author.username", read_only=True)
    author_short_fio = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()
    attachment_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectChatMessage
        fields = (
            "id",
            "body",
            "attachment",
            "attachment_url",
            "attachment_name",
            "created_at",
            "author_username",
            "author_short_fio",
        )
        read_only_fields = (
            "id",
            "created_at",
            "author_username",
            "author_short_fio",
            "attachment_url",
            "attachment_name",
        )

    def get_author_short_fio(self, obj) -> str:
        return obj.author.short_fio()

    def get_attachment_url(self, obj) -> str | None:
        f = getattr(obj, "attachment", None)
        if not f:
            return None
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri(f.url)
        return f.url

    def get_attachment_name(self, obj) -> str | None:
        return _attachment_basename(obj)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        text = (attrs.get("body") or "").strip()
        file_obj = attrs.get("attachment")
        if file_obj is not None:
            file_obj.name = _normalize_filename(file_obj.name)
        if not text and not file_obj:
            raise serializers.ValidationError(
                {"body": "Нужно написать сообщение или прикрепить файл."}
            )
        if text and len(text) > 4000:
            raise serializers.ValidationError({"body": "Не более 4000 символов."})
        attrs["body"] = text
        return attrs


class ThemeBriefSerializer(serializers.ModelSerializer):
    """Тема для профиля и переключателя (публично / в карточке пользователя)."""

    class Meta:
        model = Theme
        fields = (
            "id",
            "slug",
            "name",
            "css_variables",
            "data_theme_base",
        )


class ThemeStaffSerializer(serializers.ModelSerializer):
    """Полное описание темы для сотрудников с правами администратора (CRUD в API)."""

    class Meta:
        model = Theme
        fields = (
            "id",
            "slug",
            "name",
            "css_variables",
            "is_active",
            "data_theme_base",
            "sort_order",
            "is_default_for_unassigned",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        return attrs

    def validate_css_variables(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Ожидается JSON-объект.")
        cleaned = {}
        for key, raw in value.items():
            if not isinstance(key, str) or not key.startswith("--"):
                raise serializers.ValidationError(
                    f"Ключи должны быть CSS-переменными (--имя): {key!r}"
                )
            cleaned[key] = str(raw)
        return cleaned


class UserBriefSerializer(serializers.ModelSerializer):
    """Краткое представление: ФИО для интерфейса."""

    short_fio = serializers.SerializerMethodField()
    directorate_detail = DirectorateBriefSerializer(source="directorate", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "patronymic",
            "directorate_detail",
            "job_title",
            "short_fio",
        )

    def get_short_fio(self, obj: User) -> str:
        return obj.short_fio()


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = (
            "id",
            "name",
            "description",
            "cadence",
            "weekly_report_enabled",
            "analytics_enabled",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class ProjectCreateSerializer(serializers.ModelSerializer):
    executor_user_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
        write_only=True,
    )
    watcher_user_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
        write_only=True,
    )

    class Meta:
        model = Project
        fields = (
            "name",
            "description",
            "cadence",
            "weekly_report_enabled",
            "analytics_enabled",
            "executor_user_ids",
            "watcher_user_ids",
        )

    def create(self, validated_data):
        executor_ids = set(validated_data.pop("executor_user_ids", []))
        watcher_ids = set(validated_data.pop("watcher_user_ids", []))
        raw_slug = slugify(validated_data["name"])
        slug = raw_slug
        base = raw_slug
        n = 2
        while Project.objects.filter(slug=slug).exists():
            slug = f"{base}-{n}"
            n += 1
        validated_data["slug"] = slug
        project = super().create(validated_data)
        users = {
            u.id: u
            for u in User.objects.filter(id__in=list(executor_ids | watcher_ids), is_active=True)
        }
        for uid in executor_ids:
            user = users.get(uid)
            if user is None:
                continue
            ProjectMembership.objects.get_or_create(
                project=project,
                user=user,
                defaults={"role": ProjectMembership.Role.MEMBER},
            )
        for uid in watcher_ids:
            user = users.get(uid)
            if user is None:
                continue
            m, created = ProjectMembership.objects.get_or_create(
                project=project,
                user=user,
                defaults={"role": ProjectMembership.Role.VIEWER},
            )
            if not created and m.role == ProjectMembership.Role.VIEWER:
                continue
        return project


class MembershipSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    username = serializers.CharField(
        source="user.username", read_only=True
    )
    user_short_fio = serializers.SerializerMethodField()

    def get_user_short_fio(self, obj: ProjectMembership) -> str:
        return obj.user.short_fio()

    class Meta:
        model = ProjectMembership
        fields = ("id", "user", "username", "user_short_fio", "role")


class StatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Status
        fields = ("id", "name", "position", "is_closed", "project")
        read_only_fields = ("id", "project")


class BoardColumnSerializer(serializers.ModelSerializer):
    status_detail = StatusSerializer(source="status", read_only=True)

    class Meta:
        model = BoardColumn
        fields = ("id", "board", "status", "status_detail", "position")
        read_only_fields = ("id", "board")


class BoardSerializer(serializers.ModelSerializer):
    columns = BoardColumnSerializer(many=True, read_only=True)

    class Meta:
        model = Board
        fields = ("id", "name", "is_default", "columns", "project")
        read_only_fields = ("id", "project", "columns")


class CommentSerializer(serializers.ModelSerializer):
    author = serializers.PrimaryKeyRelatedField(read_only=True)
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ("id", "author", "author_name", "body", "created_at")
        read_only_fields = ("id", "author", "author_name", "created_at")

    def get_author_name(self, obj) -> str:
        if not obj.author:
            return ""
        return obj.author.short_fio() or obj.author.username


class WorkItemRelationSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkItemRelation
        fields = ("id", "from_item", "to_item", "relation_type")
        read_only_fields = ("id",)

    def validate(self, attrs):
        frm = attrs.get("from_item") or getattr(
            self.instance, "from_item", None
        )
        to = attrs.get("to_item") or getattr(self.instance, "to_item", None)
        if frm and to and frm.pk == to.pk:
            raise serializers.ValidationError(
                "Связь задачи с самой собой недопустима"
            )
        if frm and to and frm.project_id != to.project_id:
            raise serializers.ValidationError(
                "Связывайте задачи внутри одного проекта"
            )
        return attrs


class WorkItemSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    assignee_detail = UserBriefSerializer(
        source="assignee", read_only=True
    )
    author_detail = UserBriefSerializer(source="author", read_only=True)
    status_name = serializers.CharField(
        source="status.name", read_only=True
    )
    status_changed_at = serializers.SerializerMethodField()

    class Meta:
        model = WorkItem
        fields = (
            "id",
            "project",
            "project_name",
            "title",
            "description",
            "weekly_report_enabled",
            "analytics_enabled",
            "item_type",
            "status",
            "status_name",
            "status_changed_at",
            "priority",
            "assignee",
            "assignee_detail",
            "author",
            "author_detail",
            "start_date",
            "due_date",
            "position",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "project",
            "project_name",
            "author",
            "author_detail",
            "status_name",
            "status_changed_at",
            "assignee_detail",
            "created_at",
            "updated_at",
        )

    def validate_item_type(self, value: str) -> str:
        key = (value or "").strip().lower()
        if not key:
            raise serializers.ValidationError("Тип задачи обязателен.")
        if not WorkItemType.objects.filter(slug=key, is_active=True).exists():
            raise serializers.ValidationError("Выбран неизвестный тип задачи.")
        return key

    def get_status_changed_at(self, obj):
        history_items = getattr(obj, "status_history_cache", None)
        if history_items is not None:
            latest = history_items[0] if history_items else None
        else:
            latest = obj.status_history.order_by("-changed_at", "-id").first()
        return latest.changed_at if latest else None


class WorkItemStatusHistorySerializer(serializers.ModelSerializer):
    from_status_name = serializers.CharField(source="from_status.name", read_only=True)
    to_status_name = serializers.CharField(source="to_status.name", read_only=True)
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkItemStatusHistory
        fields = (
            "id",
            "work_item",
            "from_status",
            "from_status_name",
            "to_status",
            "to_status_name",
            "changed_by",
            "changed_by_name",
            "changed_at",
        )
        read_only_fields = fields

    def get_changed_by_name(self, obj) -> str | None:
        if not obj.changed_by:
            return None
        return obj.changed_by.short_fio() or obj.changed_by.username


class WorkItemAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkItemAttachment
        fields = (
            "id",
            "work_item",
            "file",
            "file_url",
            "file_name",
            "uploaded_by",
            "uploaded_by_name",
            "uploaded_at",
        )
        read_only_fields = (
            "id",
            "work_item",
            "file_url",
            "file_name",
            "uploaded_by",
            "uploaded_by_name",
            "uploaded_at",
        )
        extra_kwargs = {
            "file": {"write_only": True},
        }

    def get_uploaded_by_name(self, obj) -> str | None:
        if not obj.uploaded_by:
            return None
        return obj.uploaded_by.short_fio() or obj.uploaded_by.username

    def get_file_url(self, obj) -> str | None:
        file_obj = getattr(obj, "file", None)
        if not file_obj:
            return None
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri(file_obj.url)
        return file_obj.url

    def get_file_name(self, obj) -> str | None:
        return _attachment_basename(obj, field_name="file")

    def validate_file(self, value):
        value.name = _normalize_filename(value.name)
        return value


class WorkItemTypeSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = WorkItemType
        fields = ("id", "slug", "name", "is_active", "sort_order")

    def create(self, validated_data):
        raw_slug = (validated_data.pop("slug", "") or "").strip().lower()
        if not raw_slug:
            raw_slug = slugify(validated_data["name"])
        base = raw_slug or "task-type"
        slug = base
        n = 2
        while WorkItemType.objects.filter(slug=slug).exists():
            slug = f"{base}-{n}"
            n += 1
        validated_data["slug"] = slug
        return super().create(validated_data)


class WorkItemReorderSerializer(serializers.Serializer):
    status = serializers.PrimaryKeyRelatedField(queryset=Status.objects.all())
    position = serializers.IntegerField(min_value=0)
