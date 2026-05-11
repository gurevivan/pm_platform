from django.db import migrations, models


def create_default_types(apps, schema_editor):
    WorkItemType = apps.get_model("core", "WorkItemType")
    defaults = [
        ("task", "Задача", 10),
        ("bug", "Баг", 20),
        ("feature", "Фича", 30),
        ("epic", "Эпик", 40),
    ]
    for slug, name, order in defaults:
        WorkItemType.objects.get_or_create(
            slug=slug,
            defaults={
                "name": name,
                "is_active": True,
                "sort_order": order,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0015_directorate_weekly_reports"),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkItemType",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=50, unique=True, verbose_name="Код")),
                ("name", models.CharField(max_length=100, verbose_name="Название")),
                ("is_active", models.BooleanField(default=True, verbose_name="Активен")),
                ("sort_order", models.PositiveIntegerField(default=0, verbose_name="Порядок")),
            ],
            options={
                "verbose_name": "Тип задачи",
                "verbose_name_plural": "Типы задач",
                "ordering": ["sort_order", "name"],
            },
        ),
        migrations.AlterField(
            model_name="workitem",
            name="item_type",
            field=models.CharField(db_column="type", default="task", max_length=50, verbose_name="Тип задачи"),
        ),
        migrations.RunPython(create_default_types, migrations.RunPython.noop),
    ]
