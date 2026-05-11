from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0014_analytics_flags"),
    ]

    operations = [
        migrations.CreateModel(
            name="DirectorateWeeklyReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255, verbose_name="Заголовок")),
                ("period_start", models.DateField(verbose_name="Начало недели")),
                ("period_end", models.DateField(verbose_name="Конец недели")),
                ("summary", models.TextField(blank=True, verbose_name="Сводка")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="directorate_weekly_reports",
                        to="core.user",
                        verbose_name="Автор",
                    ),
                ),
                (
                    "directorate",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="weekly_reports",
                        to="core.directorate",
                        verbose_name="Дирекция",
                    ),
                ),
            ],
            options={
                "verbose_name": "Еженедельный отчёт дирекции",
                "verbose_name_plural": "Еженедельные отчёты дирекции",
                "ordering": ["-period_end", "-created_at", "-id"],
            },
        ),
    ]
