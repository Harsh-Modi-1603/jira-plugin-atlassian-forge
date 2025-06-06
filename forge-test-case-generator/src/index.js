import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { storage } from '@forge/api';

const resolver = new Resolver();

resolver.define('getJiraIssueInfo', async ({ context }) => {
  const issueKey = context.extension.issue.key;

  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}`);
    const data = await response.json();
    const fields = data.fields;
    // console.log("Fields", fields.description?.content);
    const summary = fields.summary || '';
    const description = parseContent(fields.description?.content);

    // console.log("Summary",summary);
    // console.log("Description:",description);
    return {
      userStory: description,
      acceptanceCriteria: "",
      jiraId: issueKey
    };
  } catch (error) {
    console.error('getJiraIssueInfo error:', error);
    return { error: 'Failed to fetch Jira issue details.' };
  }
});

// Fetch stored messages for current Jira issue
resolver.define('getStoredMessages', async ({ context }) => {
  const issueKey = context.extension.issue.key;
  const messages = await storage.get(`messages-${issueKey}`);
  return messages || [];
});

// Store messages for current Jira issue
resolver.define('storeMessages', async ({ context, payload }) => {
  const issueKey = context.extension.issue.key;
  const { messages } = payload;

  if (!Array.isArray(messages)) {
    return { error: 'Invalid messages format' };
  }

  await storage.set(`messages-${issueKey}`, messages);
  return { success: true };
});

export const handler = resolver.getDefinitions();

function extractText(nodes) {
  if (!Array.isArray(nodes)) return '';
  return nodes.map(node => {
    if (node.text) return node.text;
    return extractText(node.content);
  }).join('');
}

function parseContent(content) {
  if (!Array.isArray(content)) return '';

  let result = [];

  content.forEach(block => {
    const type = block.type;
    const blockContent = block.content || [];

    if (type === 'paragraph') {
      const paragraphText = extractText(blockContent);
      result.push(paragraphText);
    }

    else if (type === 'heading') {
      const headingText = extractText(blockContent);
      const level = block.attrs?.level || 1;
      result.push(`${'#'.repeat(level)} ${headingText}`);
    }

    else if (type === 'bulletList') {
      blockContent.forEach(listItem => {
        const itemText = extractText(listItem.content);
        result.push(`• ${itemText}`);
      });
    }

    else if (type === 'orderedList') {
      blockContent.forEach((listItem, index) => {
        const itemText = extractText(listItem.content);
        result.push(`${index + 1}. ${itemText}`);
      });
    }

    else {
      const fallback = extractText(blockContent);
      if (fallback) result.push(fallback);
    }
  });

  return result.join('\n');
}



