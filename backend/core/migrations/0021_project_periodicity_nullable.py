from django.db import migrations, models


def normalize_project_cadence(apps, schema_editor):
    Project = apps.get_model("core", "Project")
    Project.objects.filter(cadence__in=["infinite", "deadline"]).update(cadence=None)


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0020_project_deadline_mode"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="project",
            name="deadline_date",
        ),
        migrations.AlterField(
            model_name="project",
            name="cadence",
            field=models.CharField(
                blank=True,
                choices=[
                    ("weekly", "Еженедельный"),
                    ("monthly", "Ежемесячный"),
                ],
                default=None,
                max_length=12,
                null=True,
                verbose_name="Периодичность",
            ),
        ),
        migrations.RunPython(normalize_project_cadence, migrations.RunPython.noop),
    ]
