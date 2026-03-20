interface ThreadAnalysis {
  threadId: string;
  subject: string;
  messageCount: number;
  participants: string[];
  topics: string[];
  sentiment: "positive" | "neutral" | "negative";
  actionItems: string[];
  decisions: string[];
}

export async function analyzeGmailThreads(
  _projectId: string,
  threads: Array<{
    threadId: string;
    subject: string;
    messages: Array<{ from: string; body: string; date: string }>;
  }>
): Promise<ThreadAnalysis[]> {
  const results: ThreadAnalysis[] = [];

  for (const thread of threads) {
    const participants = [...new Set(thread.messages.map(m => m.from))];
    const fullText = thread.messages.map(m => `From: ${m.from}\n${m.body}`).join("\n---\n");

    const topics: string[] = [];
    const actionItems: string[] = [];
    const decisions: string[] = [];

    const topicKeywords: Record<string, string[]> = {
      technical: ["api", "endpoint", "deploy", "pipeline", "ci/cd", "terraform", "docker", "kubernetes"],
      commercial: ["pricing", "license", "contract", "budget", "roi", "cost"],
      blocker: ["blocked", "cannot", "issue", "problem", "delay", "risk"],
      assumption: ["assume", "expect", "believe", "should be", "likely"],
    };

    const lowerText = fullText.toLowerCase();
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(k => lowerText.includes(k))) topics.push(topic);
    }

    const actionPatterns = [/(?:action item|todo|follow up|next step)[:\s]+(.+)/gi, /(?:please|need to|should)\s+(.{10,80})/gi];
    for (const pattern of actionPatterns) {
      let match;
      while ((match = pattern.exec(fullText)) !== null) {
        actionItems.push(match[1].trim().slice(0, 120));
        if (actionItems.length >= 5) break;
      }
    }

    const posWords = ["great", "excellent", "agree", "approved", "love", "perfect", "thanks"];
    const negWords = ["issue", "problem", "delay", "blocked", "concern", "risk", "disagree"];
    const posCount = posWords.filter(w => lowerText.includes(w)).length;
    const negCount = negWords.filter(w => lowerText.includes(w)).length;
    const sentiment = posCount > negCount ? "positive" : negCount > posCount ? "negative" : "neutral";

    results.push({
      threadId: thread.threadId,
      subject: thread.subject,
      messageCount: thread.messages.length,
      participants,
      topics,
      sentiment,
      actionItems: actionItems.slice(0, 5),
      decisions,
    });
  }

  return results;
}
