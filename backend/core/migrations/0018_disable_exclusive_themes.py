from django.db import migrations


def disable_exclusive_themes(apps, schema_editor):
    Theme = apps.get_model("core", "Theme")
    Theme.objects.filter(is_exclusive=True).update(is_exclusive=False)


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0017_remove_versions_and_time_entries"),
    ]

    operations = [
        migrations.RunPython(disable_exclusive_themes, migrations.RunPython.noop),
    ]
