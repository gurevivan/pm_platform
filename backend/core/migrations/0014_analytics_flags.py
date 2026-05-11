from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0013_weekly_report_flags"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="analytics_enabled",
            field=models.BooleanField(default=False, verbose_name="Аналитика"),
        ),
        migrations.AddField(
            model_name="workitem",
            name="analytics_enabled",
            field=models.BooleanField(default=False, verbose_name="Аналитика"),
        ),
    ]
