from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Project, ProjectMembership, Status, WorkItemStatusHistory, WorkItemType


class ApiFlowTests(APITestCase):
    def setUp(self) -> None:
        self.user_model = get_user_model()
        self.owner = self.user_model.objects.create_user(
            username="owner",
            password="strong-pass-123",
        )
        self.viewer = self.user_model.objects.create_user(
            username="viewer",
            password="strong-pass-123",
        )
        self.outsider = self.user_model.objects.create_user(
            username="outsider",
            password="strong-pass-123",
        )
        self.work_item_type, _ = WorkItemType.objects.get_or_create(
            slug="task",
            defaults={"name": "Task", "is_active": True},
        )
        if not self.work_item_type.is_active:
            self.work_item_type.is_active = True
            self.work_item_type.save(update_fields=["is_active"])

        self.project = Project.objects.create(
            name="Backend test project",
            slug="backend-test-project",
            description="Project for API tests",
        )
        ProjectMembership.objects.create(
            user=self.owner,
            project=self.project,
            role=ProjectMembership.Role.ADMIN,
        )
        ProjectMembership.objects.create(
            user=self.viewer,
            project=self.project,
            role=ProjectMembership.Role.VIEWER,
        )
        self.status = Status.objects.create(
            project=self.project,
            name="To do",
            position=1,
        )

    def _login(self, username: str, password: str) -> str:
        response = self.client.post(
            reverse("token_obtain"),
            {"username": username, "password": password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data["access"]

    def _create_work_item(self) -> int:
        response = self.client.post(
            reverse("work-item-list", kwargs={"project_pk": self.project.id}),
            {
                "title": "First task",
                "description": "Task description",
                "item_type": self.work_item_type.slug,
                "status": self.status.id,
                "priority": "normal",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return int(response.data["id"])

    def test_register_login_and_get_current_user(self) -> None:
        register_response = self.client.post(
            reverse("register"),
            {
                "username": "new_user",
                "password": "strong-pass-123",
                "first_name": "Ivan",
            },
            format="json",
        )
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)

        access = self._login("new_user", "strong-pass-123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        me_response = self.client.get(reverse("users-me"))
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["username"], "new_user")

    def test_project_member_required_for_work_items_list(self) -> None:
        access = self._login("outsider", "strong-pass-123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.get(
            reverse("work-item-list", kwargs={"project_pk": self.project.id})
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_work_item_and_history_entry(self) -> None:
        access = self._login("owner", "strong-pass-123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self._create_work_item()
        self.assertEqual(WorkItemStatusHistory.objects.count(), 1)
        history = WorkItemStatusHistory.objects.first()
        self.assertIsNotNone(history)
        self.assertIsNone(history.from_status)
        self.assertEqual(history.to_status_id, self.status.id)
        self.assertEqual(history.changed_by_id, self.owner.id)

    def test_viewer_cannot_create_work_item(self) -> None:
        access = self._login("viewer", "strong-pass-123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.post(
            reverse("work-item-list", kwargs={"project_pk": self.project.id}),
            {
                "title": "Forbidden task",
                "item_type": self.work_item_type.slug,
                "status": self.status.id,
                "priority": "normal",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_work_item_history_endpoint_returns_timestamps(self) -> None:
        access = self._login("owner", "strong-pass-123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        work_item_id = self._create_work_item()
        response = self.client.get(
            reverse(
                "work-item-status-history-list",
                kwargs={
                    "project_pk": self.project.id,
                    "work_item_pk": work_item_id,
                },
            )
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertIn("changed_at", response.data[0])

    def test_admin_can_upload_work_item_attachment(self) -> None:
        access = self._login("owner", "strong-pass-123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        work_item_id = self._create_work_item()
        upload = SimpleUploadedFile(
            "note.txt",
            b"file body",
            content_type="text/plain",
        )
        response = self.client.post(
            reverse(
                "work-item-attachment-list",
                kwargs={
                    "project_pk": self.project.id,
                    "work_item_pk": work_item_id,
                },
            ),
            {"file": upload},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["file_name"], "note.txt")
