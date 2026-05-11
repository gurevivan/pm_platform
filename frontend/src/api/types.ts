export type Project = {
  id: number;
  name: string;
  description: string;
  cadence: "weekly" | "monthly" | null;
  weekly_report_enabled: boolean;
  analytics_enabled: boolean;
  created_at: string;
};

export type StatusModel = {
  id: number;
  name: string;
  position: number;
  is_closed: boolean;
  project?: number;
};

export type BoardColumn = {
  id: number;
  board: number;
  status: number;
  status_detail: StatusModel;
  position: number;
};

export type BoardModel = {
  id: number;
  name: string;
  is_default: boolean;
  columns: BoardColumn[];
  project?: number;
};

export type WorkItemType = {
  id: number;
  slug: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};


export type DirectorateBrief = {
  id: number;
  name: string;
};

export type DirectorateSubdivisionBrief = {
  id: number;
  name: string;
  kind: "group" | "department";
  kind_label: string;
  directorate: number;
  directorate_detail: DirectorateBrief;
};

/** Сообщение в общем чате дирекции. */
export type DirectorateChatMessage = {
  id: number;
  body: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  created_at: string;
  author_username: string;
  author_short_fio: string;
};

/** Сообщение чата проекта (тот же формат полей в API). */
export type ProjectChatMessage = DirectorateChatMessage;
export type SubdivisionChatMessage = DirectorateChatMessage & {
  subdivision_detail: DirectorateSubdivisionBrief;
};

export type DirectorateRecruit = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  patronymic: string;
  short_fio: string;
  job_title: string;
  directorate_detail: DirectorateBrief | null;
  subdivision_detail: DirectorateSubdivisionBrief | null;
};

export type DirectorateMember = {
  id: number;
  username: string;
  short_fio: string;
  job_title: string;
  subdivision_detail: DirectorateSubdivisionBrief | null;
};

export type DirectorateProjectAnalytics = {
  tasks: DirectorateProjectTaskAnalytics[];
  project_id: number;
  project_name: string;
  members_count: number;
  total_tasks: number;
  closed_tasks: number;
};

export type DirectorateProjectTaskAnalytics = {
  id: number;
  title: string;
  status_note_text: string;
  status_note_created_at: string | null;
  assignee_name: string;
  due_date: string | null;
};

export type DirectorateSubdivisionAnalytics = {
  id: number;
  name: string;
  kind_label: string;
  members_count: number;
  assigned_tasks: number;
  closed_tasks: number;
};

export type DirectorateAnalyticsDashboard = {
  totals: {
    members_count: number;
    projects_count: number;
    tasks_count: number;
    closed_tasks: number;
  };
  projects: DirectorateProjectAnalytics[];
  subdivisions: DirectorateSubdivisionAnalytics[];
};

export type DirectorateWeeklyReport = {
  id: number;
  title: string;
  period_start: string;
  period_end: string;
  summary: string;
  created_at: string;
  author_short_fio: string;
};

/** Тема оформления: база dark/light по slug + опциональные переопределения на :root. */
export type ThemeBrief = {
  id: number;
  slug: string;
  name: string;
  css_variables: Record<string, string>;
  /** Какую ветку селекторов [data-theme] использовать (для кастомных slug). */
  data_theme_base: "dark" | "light";
};

/** Поля темы для панели сотрудников (ответ API при авторизации staff). */
export type ThemeStaff = ThemeBrief & {
  is_active: boolean;
  sort_order: number;
  is_default_for_unassigned: boolean;
};

export type UserBrief = {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  patronymic?: string;
  directorate_detail?: DirectorateBrief | null;
  job_title?: string;
  short_fio?: string;
};

/** Текущий пользователь из «личного кабинета». */
export type MeUser = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  patronymic: string;
  directorate_detail: DirectorateBrief | null;
  subdivision_detail: DirectorateSubdivisionBrief | null;
  /** Тема по факту (с учётом дефолта сайта). */
  theme_detail: ThemeBrief | null;
  /** Явная тема пользователя; null — «как принято для всех без выбора». */
  preferred_theme_detail: ThemeBrief | null;
  job_title: string;
  short_fio: string;
  is_staff: boolean;
  is_superuser: boolean;
};

/** Пользователь в панели администратора. */
export type AdminUserRecord = MeUser & {
  is_active: boolean;
  is_superuser: boolean;
};

export type WorkItem = {
  id: number;
  project: number;
  project_name: string;
  title: string;
  description: string;
  weekly_report_enabled: boolean;
  analytics_enabled: boolean;
  item_type: string;
  status: number;
  status_name: string;
  status_changed_at: string | null;
  priority: string;
  assignee: number | null;
  assignee_detail: UserBrief | null;
  author: number;
  author_detail?: UserBrief;
  start_date: string | null;
  due_date: string | null;
  position: number;
};

export type WorkItemComment = {
  id: number;
  author: number;
  author_name: string;
  body: string;
  created_at: string;
};

export type WorkItemAttachment = {
  id: number;
  work_item: number;
  file_url: string;
  file_name: string;
  uploaded_by: number | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
};

export type WorkItemStatusHistory = {
  id: number;
  work_item: number;
  from_status: number | null;
  from_status_name: string | null;
  to_status: number;
  to_status_name: string;
  changed_by: number | null;
  changed_by_name: string | null;
  changed_at: string;
};

export type RelationType =
  | "blocks"
  | "relates"
  | "duplicates"
  | "precedes";

export type WorkItemRelation = {
  id: number;
  from_item: number;
  to_item: number;
  relation_type: RelationType;
};
