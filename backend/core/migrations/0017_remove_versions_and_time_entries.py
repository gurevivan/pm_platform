from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0016_work_item_types"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="workitem",
            name="target_version",
        ),
        migrations.DeleteModel(
            name="TimeEntry",
        ),
        migrations.DeleteModel(
            name="Version",
        ),
    ]
