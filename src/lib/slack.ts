export async function sendSlackAlert(webhookUrl: string, payload: {
  title: string;
  text: string;
  color?: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  actionUrl?: string;
}) {
  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: { type: "plain_text", text: payload.title },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: payload.text },
    },
  ];

  if (payload.fields?.length) {
    blocks.push({
      type: "section",
      fields: payload.fields.map(f => ({
        type: "mrkdwn",
        text: `*${f.title}*\n${f.value}`,
      })),
    });
  }

  if (payload.actionUrl) {
    blocks.push({
      type: "actions",
      elements: [{
        type: "button",
        text: { type: "plain_text", text: "View in CortexLab" },
        url: payload.actionUrl,
        style: "primary",
      }],
    });
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks, text: payload.title }),
  });
}
