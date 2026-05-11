"""Создание статусов и доски по умолчанию при создании проекта."""

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Board, BoardColumn, Project, Status


@receiver(post_save, sender=Project)
def create_project_defaults(
    sender, instance: Project, created: bool, **kwargs
) -> None:
    if not created:
        return
    todo = Status.objects.create(
        project=instance, name="К выполнению", position=10, is_closed=False
    )
    Status.objects.create(
        project=instance, name="В работе", position=20, is_closed=False
    )
    done = Status.objects.create(
        project=instance, name="Готово", position=30, is_closed=True
    )
    board = Board.objects.create(
        project=instance, name="Основная", is_default=True
    )
    for i, st in enumerate(
        Status.objects.filter(project=instance).order_by("position")
    ):
        BoardColumn.objects.create(board=board, status=st, position=i * 10)
