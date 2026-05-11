"""Модели домена: проекты, задачи, доски, версии, время, связи."""

import os

from django.apps import apps
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.db import models
from django.db.models import Q
from django.utils.text import slugify
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class UserManager(BaseUserManager):
    """Менеджер без поля email (как в AbstractUser.UserManager)."""

    use_in_migrations = True

    def _create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError(_("Не указан username."))
        GlobalUserModel = apps.get_model(
            self.model._meta.app_label, self.model._meta.object_name
        )
        username = GlobalUserModel.normalize_username(username)
        user = self.model(username=username, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, password, **extra_fields)

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("Суперпользователь: требуется is_staff=True."))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("Суперпользователь: требуется is_superuser=True."))
        return self._create_user(username, password, **extra_fields)


class Directorate(models.Model):
    """Справочник дирекций — заводится в админке Django."""

    name = models.CharField(_("Название"), max_length=255, unique=True)
    is_active = models.BooleanField(_("Активна"), default=True)
    sort_order = models.PositiveIntegerField(_("Порядок"), default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name = _("Дирекция")
        verbose_name_plural = _("Дирекции")

    def __str__(self) -> str:
        return self.name


class DirectorateSubdivision(models.Model):
    """Группа или отдел внутри дирекции."""

    class Kind(models.TextChoices):
        GROUP = "group", _("Группа")
        DEPARTMENT = "department", _("Отдел")

    directorate = models.ForeignKey(
        Directorate,
        on_delete=models.CASCADE,
        related_name="subdivisions",
        verbose_name=_("Дирекция"),
    )
    kind = models.CharField(
        _("Тип"),
        max_length=16,
        choices=Kind.choices,
        default=Kind.GROUP,
    )
    name = models.CharField(_("Название"), max_length=255)
    is_active = models.BooleanField(_("Активна"), default=True)
    sort_order = models.PositiveIntegerField(_("Порядок"), default=0)

    class Meta:
        ordering = ["directorate__sort_order", "sort_order", "kind", "name"]
        verbose_name = _("Группа/отдел дирекции")
        verbose_name_plural = _("Группы/отделы дирекций")
        constraints = [
            models.UniqueConstraint(
                fields=["directorate", "kind", "name"],
                name="uniq_subdivision_dir_kind_name",
            )
        ]

    def __str__(self) -> str:
        return f"{self.directorate.name}: {self.get_kind_display()} «{self.name}»"


class DirectorateChatMessage(models.Model):
    """Сообщение общего чата сотрудников одной дирекции."""

    directorate = models.ForeignKey(
        Directorate,
        on_delete=models.CASCADE,
        related_name="chat_messages",
        verbose_name=_("Дирекция"),
    )
    author = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="directorate_chat_messages",
        verbose_name=_("Автор"),
    )
    body = models.TextField(_("Текст сообщения"), blank=True)
    attachment = models.FileField(
        _("Файл"),
        upload_to="directorate_chat/%Y/%m/%d/",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(_("Создано"), auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = _("Сообщение чата дирекции")
        verbose_name_plural = _("Сообщения чата дирекции")

    def __str__(self) -> str:
        return f"{self.directorate_id} ← {self.author_id} @ {self.created_at:%Y-%m-%d %H:%M}"


class DirectorateSubdivisionChatMessage(models.Model):
    """Сообщение чата группы/отдела внутри дирекции."""

    subdivision = models.ForeignKey(
        DirectorateSubdivision,
        on_delete=models.CASCADE,
        related_name="chat_messages",
        verbose_name=_("Группа/отдел"),
    )
    author = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="subdivision_chat_messages",
        verbose_name=_("Автор"),
    )
    body = models.TextField(_("Текст сообщения"))
    created_at = models.DateTimeField(_("Создано"), auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = _("Сообщение чата группы/отдела")
        verbose_name_plural = _("Сообщения чата групп/отделов")

    def __str__(self) -> str:
        return (
            f"subdivision {self.subdivision_id} ← {self.author_id} @ "
            f"{self.created_at:%Y-%m-%d %H:%M}"
        )


class ProjectChatMessage(models.Model):
    """Сообщение общего чата участников проекта."""

    project = models.ForeignKey(
        "Project",
        on_delete=models.CASCADE,
        related_name="chat_messages",
        verbose_name=_("Проект"),
    )
    author = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="project_chat_messages",
        verbose_name=_("Автор"),
    )
    body = models.TextField(_("Текст сообщения"), blank=True)
    attachment = models.FileField(
        _("Файл"),
        upload_to="project_chat/%Y/%m/%d/",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(_("Создано"), auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = _("Сообщение чата проекта")
        verbose_name_plural = _("Сообщения чата проекта")

    def __str__(self) -> str:
        return f"project {self.project_id} ← {self.author_id} @ {self.created_at:%Y-%m-%d %H:%M}"


class DirectorateWeeklyReport(models.Model):
    directorate = models.ForeignKey(
        Directorate,
        on_delete=models.CASCADE,
        related_name="weekly_reports",
        verbose_name=_("Дирекция"),
    )
    author = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="directorate_weekly_reports",
        verbose_name=_("Автор"),
    )
    title = models.CharField(_("Заголовок"), max_length=255)
    period_start = models.DateField(_("Начало недели"))
    period_end = models.DateField(_("Конец недели"))
    summary = models.TextField(_("Сводка"), blank=True)
    created_at = models.DateTimeField(_("Дата создания"), auto_now_add=True)

    class Meta:
        ordering = ["-period_end", "-created_at", "-id"]
        verbose_name = _("Еженедельный отчёт дирекции")
        verbose_name_plural = _("Еженедельные отчёты дирекции")

    def __str__(self) -> str:
        return f"{self.directorate_id}:{self.period_start}..{self.period_end}"


class Theme(models.Model):
    """Тема интерфейса SPA: slug + при необходимости переопределение CSS-переменных."""

    class DataThemeBase(models.TextChoices):
        """Какая ветка селекторов [data-theme=…] в CSS применяется к html."""

        DARK = "dark", _("Тёмная ветка")
        LIGHT = "light", _("Светлая ветка")

    slug = models.SlugField(
        _("Идентификатор темы"),
        max_length=64,
        unique=True,
        help_text=_(
            "Базовая палитра из файла стилей: «dark» или «light». "
            "Для своих имён задайте ниже «Переменные CSS» — тогда оформление задаётся без правок кода."
        ),
    )
    name = models.CharField(_("Название"), max_length=100)
    css_variables = models.JSONField(
        _("Переменные CSS"),
        default=dict,
        blank=True,
        help_text=_(
            "Объект вида {\"--bg0\": \"#05060a\", \"--text\": \"#e2e8f0\"} — ключи как в :root. "
            "Пусто — только базовая палитра по slug (dark/light)."
        ),
    )
    is_active = models.BooleanField(_("Доступна для выбора"), default=True)
    is_exclusive = models.BooleanField(
        _("Только по назначению администратора"),
        default=False,
        help_text=_(
            "Не попадает в общий список тем и в личный кабинет; переключатель тем в шапке её обходит. "
            "Назначить может только сотрудник в разделе «Сотрудники» или Django admin."
        ),
    )
    data_theme_base = models.CharField(
        _("База интерфейса (CSS)"),
        max_length=5,
        choices=DataThemeBase.choices,
        default=DataThemeBase.DARK,
        help_text=_(
            "Для slug не «dark»/«light»: какой режим вёрстки использовать (светлые/тёмные правила в CSS)."
        ),
    )
    sort_order = models.PositiveIntegerField(_("Порядок"), default=0)
    is_default_for_unassigned = models.BooleanField(
        _("Стандартная для пользователей без темы"),
        default=False,
        help_text=_(
            "Применяется, если у пользователя не указана своя тема. "
            "Можно отметить только у одной темы (при сохранении остальные снимаются)."
        ),
    )

    class Meta:
        ordering = ["sort_order", "slug"]
        verbose_name = _("Тема оформления")
        verbose_name_plural = _("Темы оформления")

    def __str__(self) -> str:
        return f"{self.name} ({self.slug})"

    def clean(self) -> None:
        super().clean()

    def save(self, *args, **kwargs):
        """Гарантия единственной «стандартной» темы."""
        clear_others = kwargs.pop("_enforce_single_site_default_theme", True)
        super().save(*args, **kwargs)
        if clear_others and self.is_default_for_unassigned:
            Theme.objects.exclude(pk=self.pk).update(is_default_for_unassigned=False)

    @classmethod
    def resolve_for_user(cls, user) -> "Theme | None":
        """Явная тема пользователя или одна общая тема по умолчанию."""
        t = getattr(user, "preferred_theme", None)
        if t is not None and t.is_active:
            return t
        return (
            cls.objects.filter(
                is_active=True,
                is_default_for_unassigned=True,
            )
            .order_by("sort_order", "slug")
            .first()
        )


class User(AbstractBaseUser, PermissionsMixin):
    """Пользователь: логин, ФИО, дирекция и должность (без email)."""

    username_validator = UnicodeUsernameValidator()

    username = models.CharField(
        _("Логин"),
        max_length=150,
        unique=True,
        help_text=_(
            "Обязательно. До 150 символов. Буквы, цифры и символы @/./+/-/_."
        ),
        validators=[username_validator],
        error_messages={
            "unique": _("Пользователь с таким логином уже существует."),
        },
    )
    first_name = models.CharField(_("Имя"), max_length=150, blank=True)
    last_name = models.CharField(_("Фамилия"), max_length=150, blank=True)
    is_staff = models.BooleanField(
        _("Статус персонала"),
        default=False,
        help_text=_("Доступ к панели администратора Django."),
    )
    is_active = models.BooleanField(
        _("Активен"),
        default=True,
        help_text=_("Снимите флажок вместо удаления учётной записи."),
    )
    date_joined = models.DateTimeField(_("Дата регистрации"), default=timezone.now)

    patronymic = models.CharField("Отчество", max_length=150, blank=True)
    directorate = models.ForeignKey(
        Directorate,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="employees",
        verbose_name="Дирекция",
    )
    subdivision = models.ForeignKey(
        DirectorateSubdivision,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="employees",
        verbose_name=_("Группа/отдел"),
        help_text=_(
            "Опционально: группа или отдел внутри выбранной дирекции."
        ),
    )
    preferred_theme = models.ForeignKey(
        Theme,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="users",
        verbose_name=_("Тема оформления"),
        help_text=_(
            "Пусто — для пользователя действует общая тема по умолчанию "
            "(см. «Стандартная для пользователей без темы» в списке тем)."
        ),
    )
    job_title = models.CharField("Должность", max_length=255, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "core_user"
        verbose_name = _("Пользователь")
        verbose_name_plural = _("Пользователи")

    def clean(self) -> None:
        from django.core.exceptions import ValidationError

        super().clean()
        if self.subdivision_id and not self.directorate_id:
            raise ValidationError(
                {
                    "subdivision": _(
                        "Нельзя выбрать группу/отдел без указания дирекции."
                    )
                }
            )
        if (
            self.subdivision_id
            and self.directorate_id
            and self.subdivision.directorate_id != self.directorate_id
        ):
            raise ValidationError(
                {
                    "subdivision": _(
                        "Группа/отдел должен принадлежать выбранной дирекции."
                    )
                }
            )

    def short_fio(self) -> str:
        """Фамилия И. О. для списков."""
        parts = []
        if self.last_name:
            parts.append(self.last_name.strip())
        inits = []
        if self.first_name:
            inits.append(f"{self.first_name.strip()[0].upper()}.")
        if self.patronymic:
            inits.append(f"{self.patronymic.strip()[0].upper()}.")
        tail = "".join(inits)
        return f"{' '.join(parts)} {tail}".strip() if parts or tail else self.username


class Project(models.Model):
    class Cadence(models.TextChoices):
        WEEKLY = "weekly", _("Еженедельный")
        MONTHLY = "monthly", _("Ежемесячный")

    name = models.CharField(_("Название"), max_length=255)
    slug = models.SlugField(_("Слаг"), unique=True, max_length=255)
    description = models.TextField(_("Описание"), blank=True)
    cadence = models.CharField(
        _("Периодичность"),
        max_length=12,
        choices=Cadence.choices,
        null=True,
        blank=True,
        default=None,
    )
    weekly_report_enabled = models.BooleanField(
        _("Еженедельный отчёт"),
        default=False,
    )
    analytics_enabled = models.BooleanField(
        _("Аналитика"),
        default=False,
    )
    created_at = models.DateTimeField(_("Дата создания"), auto_now_add=True)

    class Meta:
        verbose_name = _("Проект")
        verbose_name_plural = _("Проекты")

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not (self.slug or "").strip():
            base = slugify(self.name) or "project"
            slug = base
            n = 2
            while Project.objects.exclude(pk=self.pk).filter(slug=slug).exists():
                slug = f"{base}-{n}"
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)


class ProjectMembership(models.Model):
    class Role(models.TextChoices):
        VIEWER = "viewer", "Наблюдатель"
        MEMBER = "member", "Участник"
        DEVELOPER = "developer", "Разработчик"
        MANAGER = "manager", "Менеджер"
        ADMIN = "admin", "Админ проекта"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="memberships",
        verbose_name=_("Пользователь"),
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="memberships",
        verbose_name=_("Проект"),
    )
    role = models.CharField(
        _("Роль"),
        max_length=20,
        choices=Role.choices,
        default=Role.MEMBER,
    )

    class Meta:
        verbose_name = _("Участие в проекте")
        verbose_name_plural = _("Участия в проектах")
        constraints = [
            models.UniqueConstraint(
                fields=["user", "project"], name="uniq_membership_user_project"
            )
        ]

    def __str__(self) -> str:
        return f"{self.user} @ {self.project}"


class Status(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="statuses",
        verbose_name=_("Проект"),
    )
    name = models.CharField(_("Название"), max_length=100)
    position = models.PositiveIntegerField(_("Порядок"), default=0)
    is_closed = models.BooleanField(_("Закрывает задачу"), default=False)

    class Meta:
        ordering = ["position", "id"]
        verbose_name = _("Статус")
        verbose_name_plural = _("Статусы")
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"], name="uniq_status_per_project"
            )
        ]

    def __str__(self) -> str:
        return f"{self.project.slug}:{self.name}"


class WorkItemType(models.Model):
    slug = models.SlugField(_("Код"), max_length=50, unique=True)
    name = models.CharField(_("Название"), max_length=100)
    is_active = models.BooleanField(_("Активен"), default=True)
    sort_order = models.PositiveIntegerField(_("Порядок"), default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name = _("Тип задачи")
        verbose_name_plural = _("Типы задач")

    def __str__(self) -> str:
        return self.name


class WorkItem(models.Model):
    class Priority(models.TextChoices):
        LOW = "low", "Низкий"
        NORMAL = "normal", "Обычный"
        HIGH = "high", "Высокий"
        URGENT = "urgent", "Срочный"

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="work_items",
        verbose_name=_("Проект"),
    )
    title = models.CharField(_("Заголовок"), max_length=500)
    description = models.TextField(_("Описание"), blank=True)
    weekly_report_enabled = models.BooleanField(
        _("Еженедельный отчёт"),
        default=False,
    )
    analytics_enabled = models.BooleanField(
        _("Аналитика"),
        default=False,
    )
    item_type = models.CharField(
        _("Тип задачи"),
        max_length=50,
        default="task",
        db_column="type",
    )
    status = models.ForeignKey(
        Status,
        on_delete=models.PROTECT,
        related_name="work_items",
        verbose_name=_("Статус"),
    )
    priority = models.CharField(
        _("Приоритет"),
        max_length=20,
        choices=Priority.choices,
        default=Priority.NORMAL,
    )
    assignee = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_work_items",
        verbose_name=_("Исполнитель"),
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="created_work_items",
        verbose_name=_("Автор"),
    )
    start_date = models.DateField(_("Дата начала"), null=True, blank=True)
    due_date = models.DateField(_("Срок выполнения"), null=True, blank=True)
    position = models.PositiveIntegerField(_("Порядок в колонке"), default=0)
    created_at = models.DateTimeField(_("Дата создания"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Дата изменения"), auto_now=True)

    class Meta:
        ordering = ["status_id", "position", "id"]
        verbose_name = _("Задача")
        verbose_name_plural = _("Задачи")
        indexes = [
            models.Index(fields=["project", "status"]),
            models.Index(fields=["project", "assignee"]),
        ]

    def __str__(self) -> str:
        return self.title


class WorkItemStatusHistory(models.Model):
    work_item = models.ForeignKey(
        WorkItem,
        on_delete=models.CASCADE,
        related_name="status_history",
        verbose_name=_("Задача"),
    )
    from_status = models.ForeignKey(
        Status,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="status_history_from",
        verbose_name=_("Из статуса"),
    )
    to_status = models.ForeignKey(
        Status,
        on_delete=models.PROTECT,
        related_name="status_history_to",
        verbose_name=_("В статус"),
    )
    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="work_item_status_changes",
        verbose_name=_("Кем изменено"),
    )
    changed_at = models.DateTimeField(_("Дата изменения"), auto_now_add=True)

    class Meta:
        ordering = ["-changed_at", "-id"]
        verbose_name = _("История смены статуса задачи")
        verbose_name_plural = _("История смены статусов задач")
        indexes = [
            models.Index(fields=["work_item", "changed_at"]),
        ]

    def __str__(self) -> str:
        from_name = self.from_status.name if self.from_status else "—"
        return f"{self.work_item_id}: {from_name} -> {self.to_status.name}"


class WorkItemAttachment(models.Model):
    work_item = models.ForeignKey(
        WorkItem,
        on_delete=models.CASCADE,
        related_name="attachments",
        verbose_name=_("Задача"),
    )
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="work_item_attachments",
        verbose_name=_("Кем загружено"),
    )
    file = models.FileField(_("Файл"), upload_to="work_item_attachments/%Y/%m/%d/")
    uploaded_at = models.DateTimeField(_("Дата загрузки"), auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at", "-id"]
        verbose_name = _("Вложение задачи")
        verbose_name_plural = _("Вложения задач")
        indexes = [
            models.Index(fields=["work_item", "uploaded_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.work_item_id}: {os.path.basename(self.file.name)}"


class Comment(models.Model):
    work_item = models.ForeignKey(
        WorkItem,
        on_delete=models.CASCADE,
        related_name="comments",
        verbose_name=_("Задача"),
    )
    author = models.ForeignKey(
        User, on_delete=models.CASCADE, verbose_name=_("Автор")
    )
    body = models.TextField(_("Текст"))
    created_at = models.DateTimeField(_("Дата создания"), auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = _("Комментарий")
        verbose_name_plural = _("Комментарии")

    def __str__(self) -> str:
        return f"Comment #{self.pk} on {self.work_item_id}"


class Board(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="boards",
        verbose_name=_("Проект"),
    )
    name = models.CharField(_("Название"), max_length=255, default="Основная")
    is_default = models.BooleanField(_("Доска по умолчанию"), default=False)

    class Meta:
        verbose_name = _("Доска")
        verbose_name_plural = _("Доски")

    def __str__(self) -> str:
        return f"{self.project.slug}:{self.name}"


class BoardColumn(models.Model):
    board = models.ForeignKey(
        Board,
        on_delete=models.CASCADE,
        related_name="columns",
        verbose_name=_("Доска"),
    )
    status = models.ForeignKey(
        Status, on_delete=models.CASCADE, verbose_name=_("Статус")
    )
    position = models.PositiveIntegerField(_("Порядок"), default=0)

    class Meta:
        ordering = ["position", "id"]
        verbose_name = _("Колонка доски")
        verbose_name_plural = _("Колонки досок")
        constraints = [
            models.UniqueConstraint(
                fields=["board", "status"], name="uniq_board_status"
            )
        ]


class WorkItemRelation(models.Model):
    class RelationType(models.TextChoices):
        BLOCKS = "blocks", "Блокирует"
        RELATES = "relates", "Связана с"
        DUPLICATES = "duplicates", "Дубликат"
        PRECEDES = "precedes", "Предшествует (Гант FS)"

    from_item = models.ForeignKey(
        WorkItem,
        on_delete=models.CASCADE,
        related_name="relations_out",
        verbose_name=_("Исходная задача"),
    )
    to_item = models.ForeignKey(
        WorkItem,
        on_delete=models.CASCADE,
        related_name="relations_in",
        verbose_name=_("Связанная задача"),
    )
    relation_type = models.CharField(
        _("Тип связи"), max_length=20, choices=RelationType.choices
    )

    class Meta:
        verbose_name = _("Связь между задачами")
        verbose_name_plural = _("Связи между задачами")
        constraints = [
            models.UniqueConstraint(
                fields=["from_item", "to_item", "relation_type"],
                name="uniq_workitem_relation",
            ),
            models.CheckConstraint(
                condition=~Q(from_item=models.F("to_item")),
                name="relation_no_self",
            ),
        ]
