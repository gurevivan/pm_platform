from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0021_project_periodicity_nullable"),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkItemStatusHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("changed_at", models.DateTimeField(auto_now_add=True, verbose_name="Дата изменения")),
                (
                    "changed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="work_item_status_changes",
                        to="core.user",
                        verbose_name="Кем изменено",
                    ),
                ),
                (
                    "from_status",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="status_history_from",
                        to="core.status",
                        verbose_name="Из статуса",
                    ),
                ),
                (
                    "to_status",
                    models.ForeignKey(
                        on_delete=models.deletion.PROTECT,
                        related_name="status_history_to",
                        to="core.status",
                        verbose_name="В статус",
                    ),
                ),
                (
                    "work_item",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="status_history",
                        to="core.workitem",
                        verbose_name="Задача",
                    ),
                ),
            ],
            options={
                "verbose_name": "История смены статуса задачи",
                "verbose_name_plural": "История смены статусов задач",
                "ordering": ["-changed_at", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="workitemstatushistory",
            index=models.Index(fields=["work_item", "changed_at"], name="core_workit_work_it_3f7f47_idx"),
        ),
    ]
