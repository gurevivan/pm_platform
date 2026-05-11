"""Проверки прав по роли членства в проекте."""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Project, ProjectMembership, WorkItem


def _resolve_project_id(obj) -> int | None:
    if isinstance(obj, Project):
        return obj.id
    pid = getattr(obj, "project_id", None)
    if pid:
        return int(pid)
    p = getattr(obj, "project", None)
    if p is not None:
        return p.id
    wid = getattr(obj, "work_item_id", None)
    if wid:
        wi = WorkItem.objects.filter(pk=wid).values_list(
            "project_id", flat=True
        ).first()
        return int(wi) if wi else None
    fid = getattr(obj, "from_item_id", None)
    if fid:
        wi = WorkItem.objects.filter(pk=fid).values_list(
            "project_id", flat=True
        ).first()
        return int(wi) if wi else None
    return None


class IsProjectViewer(BasePermission):
    """Чтение: любой участник проекта."""

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        pid = _resolve_project_id(obj)
        if pid is None:
            return False
        return ProjectMembership.objects.filter(
            project_id=pid, user=request.user
        ).exists()


class IsProjectContributor(IsProjectViewer):
    """Изменение: участник не viewer."""

    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False
        if request.method in SAFE_METHODS:
            return True
        project_id = getattr(view, "kwargs", {}).get("project_pk")
        if project_id is None:
            return True
        role = membership_role(int(project_id), request.user)
        return role is not None and role != ProjectMembership.Role.VIEWER

    def has_object_permission(self, request, view, obj):
        if not super().has_object_permission(request, view, obj):
            return False
        if request.method in SAFE_METHODS:
            return True
        pid = _resolve_project_id(obj)
        if pid is None:
            return False
        role = membership_role(pid, request.user)
        return role is not None and role != ProjectMembership.Role.VIEWER


class IsProjectManager(IsProjectViewer):
    """Управление проектом: manager или admin."""

    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False
        if request.method in SAFE_METHODS:
            return True
        project_id = getattr(view, "kwargs", {}).get("project_pk")
        if project_id is None:
            return True
        role = membership_role(int(project_id), request.user)
        return role in (
            ProjectMembership.Role.MANAGER,
            ProjectMembership.Role.ADMIN,
        )

    def has_object_permission(self, request, view, obj):
        if not super().has_object_permission(request, view, obj):
            return False
        if request.method in SAFE_METHODS:
            return True
        pid = (
            getattr(obj, "id", None) if isinstance(obj, Project) else _resolve_project_id(obj)
        )
        if pid is None:
            return False
        role = membership_role(pid, request.user)
        return role in (
            ProjectMembership.Role.MANAGER,
            ProjectMembership.Role.ADMIN,
        )


def membership_role(project_id: int, user):
    """Возвращает роль пользователя или None."""
    return (
        ProjectMembership.objects.filter(project_id=project_id, user=user)
        .values_list("role", flat=True)
        .first()
    )


class HasDirectorate(BasePermission):
    """Доступ только у сотрудников с заполненной дирекцией в карточке."""

    message = "Укажите дирекцию в личном кабинете, чтобы пользоваться чатом дирекции."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "directorate_id", None)
        )


class HasSubdivision(BasePermission):
    """Доступ только у сотрудников с заполненной группой/отделом."""

    message = (
        "Укажите группу/отдел в личном кабинете, "
        "чтобы пользоваться чатом группы/отдела."
    )

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "subdivision_id", None)
        )
