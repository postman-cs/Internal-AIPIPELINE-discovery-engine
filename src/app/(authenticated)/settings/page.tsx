import { getJiraSettings } from "@/lib/actions/settings";
import { JiraSettingsForm } from "./JiraSettingsForm";

export default async function SettingsPage() {
  const jira = await getJiraSettings();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--foreground)" }}
        >
          Settings
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: "var(--foreground-dim)" }}
        >
          Configure integrations and account preferences
        </p>
      </div>

      <div className="space-y-6">
        <JiraSettingsForm
          initialValues={{
            jiraBaseUrl: jira.jiraBaseUrl,
            jiraEmail: jira.jiraEmail,
            jiraApiToken: jira.jiraApiToken,
            jiraDefaultProject: jira.jiraDefaultProject,
            jiraIssueType: jira.jiraIssueType,
          }}
          isConfigured={jira.isConfigured}
        />
      </div>
    </div>
  );
}
