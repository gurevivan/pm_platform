from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    Board,
    BoardColumn,
    Comment,
    Directorate,
    DirectorateChatMessage,
    DirectorateSubdivision,
    DirectorateSubdivisionChatMessage,
    DirectorateWeeklyReport,
    Project,
    ProjectChatMessage,
    ProjectMembership,
    Status,
    Theme,
    User,
    WorkItemType,
    WorkItem,
    WorkItemAttachment,
    WorkItemStatusHistory,
    WorkItemRelation,
)


@admin.register(Theme)
class ThemeAdmin(admin.ModelAdmin):
    exclude = ("is_exclusive",)
    list_display = (
        "name",
        "slug",
        "is_active",
        "data_theme_base",
        "sort_order",
        "is_default_for_unassigned",
    )
    list_filter = ("is_active", "data_theme_base", "is_default_for_unassigned")
    search_fields = ("name", "slug")
    ordering = ("sort_order", "slug")
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "name",
                    "slug",
                    "css_variables",
                    "is_active",
                    "data_theme_base",
                    "sort_order",
                    "is_default_for_unassigned",
                )
            },
        ),
    )


@admin.register(DirectorateChatMessage)
class DirectorateChatMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "directorate", "author", "has_attachment", "short_body", "created_at")
    list_filter = ("directorate", "created_at")
    search_fields = ("body", "author__username", "author__last_name", "author__first_name")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)

    @admin.display(description="Текст")
    def short_body(self, obj: DirectorateChatMessage) -> str:
        b = (obj.body or "").replace("\n", " ")
        return b[:100] + ("…" if len(b) > 100 else "")

    @admin.display(description="Файл")
    def has_attachment(self, obj: DirectorateChatMessage) -> str:
        return "да" if obj.attachment else "—"


@admin.register(DirectorateSubdivisionChatMessage)
class DirectorateSubdivisionChatMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "subdivision", "author", "short_body", "created_at")
    list_filter = ("subdivision", "created_at")
    search_fields = ("body", "author__username", "author__last_name", "author__first_name")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)

    @admin.display(description="Текст")
    def short_body(self, obj: DirectorateSubdivisionChatMessage) -> str:
        b = (obj.body or "").replace("\n", " ")
        return b[:100] + ("…" if len(b) > 100 else "")


@admin.register(DirectorateSubdivision)
class DirectorateSubdivisionAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "directorate", "is_active", "sort_order")
    list_filter = ("kind", "directorate", "is_active")
    search_fields = ("name", "directorate__name")
    ordering = ("directorate__sort_order", "sort_order", "kind", "name")


@admin.register(DirectorateWeeklyReport)
class DirectorateWeeklyReportAdmin(admin.ModelAdmin):
    list_display = ("title", "directorate", "author", "period_start", "period_end", "created_at")
    list_filter = ("directorate", "period_start", "period_end")
    search_fields = ("title", "summary", "author__username", "author__last_name")
    readonly_fields = ("created_at",)
    ordering = ("-period_end", "-created_at")


@admin.register(Directorate)
class DirectorateAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "sort_order")
    list_filter = ("is_active",)
    search_fields = ("name",)
    ordering = ("sort_order", "name")


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("last_name", "first_name", "username")
    list_display = (
        "username",
        "short_fio_list",
        "directorate",
        "job_title",
        "is_staff",
        "is_active",
    )
    list_filter = ("is_staff", "is_superuser", "is_active")
    search_fields = ("username", "first_name", "last_name", "patronymic")

    @admin.display(description="ФИО")
    def short_fio_list(self, obj: User) -> str:
        return obj.short_fio()

    fieldsets = (
        (None, {"fields": ("username", "password")}),
        (
            "Личные данные",
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "patronymic",
                )
            },
        ),
        ("Организация", {"fields": ("directorate", "subdivision", "job_title")}),
        (
            "Интерфейс",
            {
                "fields": ("preferred_theme",),
                "description": (
                    "Пустое значение — используется тема, помеченная как "
                    "«Стандартная для пользователей без темы» в разделе «Темы оформления»."
                ),
            },
        ),
        (
            "Права",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        ("Важные даты", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "password1",
                    "password2",
                    "first_name",
                    "last_name",
                    "patronymic",
                    "directorate",
                    "subdivision",
                    "job_title",
                    "preferred_theme",
                ),
            },
        ),
    )


@admin.register(ProjectChatMessage)
class ProjectChatMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "project", "author", "short_body", "created_at")
    list_filter = ("project", "created_at")
    search_fields = (
        "body",
        "project__name",
        "author__username",
        "author__last_name",
    )
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)

    @admin.display(description="Текст")
    def short_body(self, obj: ProjectChatMessage) -> str:
        b = (obj.body or "").replace("\n", " ")
        return b[:100] + ("…" if len(b) > 100 else "")


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    exclude = ("slug",)
    list_display = ("name", "cadence", "weekly_report_enabled", "analytics_enabled", "created_at")
    search_fields = ("name",)
    ordering = ("name",)


admin.site.register(ProjectMembership)
admin.site.register(Status)
admin.site.register(WorkItemType)
admin.site.register(Board)
admin.site.register(BoardColumn)


@admin.register(WorkItem)
class WorkItemAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "project",
        "status",
        "assignee",
        "weekly_report_enabled",
        "analytics_enabled",
    )


admin.site.register(Comment)
admin.site.register(WorkItemRelation)
admin.site.register(WorkItemStatusHistory)
admin.site.register(WorkItemAttachment)
