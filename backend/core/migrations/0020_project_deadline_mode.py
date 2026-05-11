from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0019_project_cadence"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="deadline_date",
            field=models.DateField(blank=True, null=True, verbose_name="Срок проекта"),
        ),
        migrations.AlterField(
            model_name="project",
            name="cadence",
            field=models.CharField(
                choices=[
                    ("weekly", "Еженедельный"),
                    ("monthly", "Ежемесячный"),
                    ("deadline", "Со сроком"),
                ],
                default="weekly",
                max_length=12,
                verbose_name="Режим проекта",
            ),
        ),
    ]
