"""Корневые URL: админка, OpenAPI, JWT, API v1."""

from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_nested import routers
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.auth_views import RegisterView
from core.user_views import (
    AdminUserViewSet,
    CurrentUserView,
    DirectorateMembersView,
    DirectorateProjectAnalyticsView,
    DirectorateRecruitViewSet,
    DirectorateWeeklyReportDetailView,
    DirectorateWeeklyReportListCreateView,
    UserDirectoryViewSet,
)
from core.views import (
    BoardViewSet,
    CommentViewSet,
    DirectorateChatMessageViewSet,
    DirectorateSubdivisionViewSet,
    DirectorateViewSet,
    MembershipViewSet,
    MyTasksViewSet,
    ProjectChatMessageViewSet,
    ProjectViewSet,
    StatusViewSet,
    ThemeViewSet,
    WorkItemTypeViewSet,
    WorkItemRelationViewSet,
    WorkItemAttachmentViewSet,
    WorkItemStatusHistoryViewSet,
    WorkItemViewSet,
)

router = routers.SimpleRouter()
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"directorates", DirectorateViewSet, basename="directorate")
router.register(
    r"directorate-subdivisions",
    DirectorateSubdivisionViewSet,
    basename="directorate-subdivision",
)
router.register(r"themes", ThemeViewSet, basename="theme")
router.register(r"work-item-types", WorkItemTypeViewSet, basename="work-item-type")
router.register(
    r"directorate-chat/messages",
    DirectorateChatMessageViewSet,
    basename="directorate-chat-message",
)
router.register(r"admin/users", AdminUserViewSet, basename="admin-users")
router.register(
    r"directorate/recruits",
    DirectorateRecruitViewSet,
    basename="directorate-recruit",
)
router.register(r"users", UserDirectoryViewSet, basename="user-directory")
router.register(r"my-tasks", MyTasksViewSet, basename="my-tasks")

p_router = routers.NestedSimpleRouter(router, r"projects", lookup="project")
p_router.register(r"memberships", MembershipViewSet, basename="membership")
p_router.register(r"statuses", StatusViewSet, basename="status")
p_router.register(r"boards", BoardViewSet, basename="board")
p_router.register(r"work-items", WorkItemViewSet, basename="work-item")
p_router.register(
    r"relations", WorkItemRelationViewSet, basename="workitem-relation"
)
p_router.register(
    r"chat/messages",
    ProjectChatMessageViewSet,
    basename="project-chat-message",
)

wi_router = routers.NestedSimpleRouter(
    p_router, r"work-items", lookup="work_item"
)
wi_router.register(r"comments", CommentViewSet, basename="comment")
wi_router.register(
    r"attachments",
    WorkItemAttachmentViewSet,
    basename="work-item-attachment",
)
wi_router.register(
    r"status-history",
    WorkItemStatusHistoryViewSet,
    basename="work-item-status-history",
)

admin.site.site_header = "Панель администратора"
admin.site.site_title = "Единое окно задач"
admin.site.index_title = "Разделы"

urlpatterns = [
    path(
        "",
        RedirectView.as_view(pattern_name="swagger", permanent=False),
        name="root",
    ),
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger",
    ),
    path("api/v1/auth/register/", RegisterView.as_view(), name="register"),
    path(
        "api/v1/auth/token/",
        TokenObtainPairView.as_view(),
        name="token_obtain",
    ),
    path(
        "api/v1/auth/token/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path("api/v1/users/me/", CurrentUserView.as_view(), name="users-me"),
    path("api/v1/directorate/members/", DirectorateMembersView.as_view(), name="directorate-members"),
    path(
        "api/v1/directorate/projects/analytics/",
        DirectorateProjectAnalyticsView.as_view(),
        name="directorate-project-analytics",
    ),
    path(
        "api/v1/directorate/weekly-reports/",
        DirectorateWeeklyReportListCreateView.as_view(),
        name="directorate-weekly-reports",
    ),
    path(
        "api/v1/directorate/weekly-reports/<int:report_id>/",
        DirectorateWeeklyReportDetailView.as_view(),
        name="directorate-weekly-report-detail",
    ),
    path("api/v1/", include(router.urls)),
    path("api/v1/", include(p_router.urls)),
    path("api/v1/", include(wi_router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
