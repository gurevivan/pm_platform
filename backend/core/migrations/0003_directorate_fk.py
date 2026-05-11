# Generated manually for справочник дирекций

import django.db.models.deletion
from django.db import migrations, models


def migrate_legacy_directorate(apps, schema_editor):
    User = apps.get_model("core", "User")
    Directorate = apps.get_model("core", "Directorate")
    cache: dict[str, int] = {}
    for u in User.objects.exclude(directorate_legacy="").exclude(
        directorate_legacy__isnull=True
    ):
        name = (u.directorate_legacy or "").strip()
        if not name:
            continue
        if name not in cache:
            d, _ = Directorate.objects.get_or_create(
                name=name[:255],
                defaults={"is_active": True, "sort_order": 0},
            )
            cache[name] = d.pk
        User.objects.filter(pk=u.pk).update(directorate_id=cache[name])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_user_profile_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="Directorate",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "name",
                    models.CharField(max_length=255, unique=True, verbose_name="Название"),
                ),
                (
                    "is_active",
                    models.BooleanField(default=True, verbose_name="Активна"),
                ),
                (
                    "sort_order",
                    models.PositiveIntegerField(default=0, verbose_name="Порядок"),
                ),
            ],
            options={
                "verbose_name": "Дирекция",
                "verbose_name_plural": "Дирекции",
                "ordering": ["sort_order", "name"],
            },
        ),
        migrations.RenameField(
            model_name="user",
            old_name="directorate",
            new_name="directorate_legacy",
        ),
        migrations.AddField(
            model_name="user",
            name="directorate",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="employees",
                to="core.directorate",
                verbose_name="Дирекция",
            ),
        ),
        migrations.RunPython(migrate_legacy_directorate, noop_reverse),
        migrations.RemoveField(
            model_name="user",
            name="directorate_legacy",
        ),
    ]
