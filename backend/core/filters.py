import django_filters

from .models import WorkItem


class WorkItemFilter(django_filters.FilterSet):
    status = django_filters.NumberFilter(field_name="status_id")
    assignee = django_filters.NumberFilter(field_name="assignee_id")

    class Meta:
        model = WorkItem
        fields = ["status", "assignee", "item_type", "priority"]
