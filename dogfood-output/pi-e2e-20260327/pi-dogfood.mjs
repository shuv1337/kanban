import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT = '/home/shuv/repos/kanban/dogfood-output/pi-e2e-20260327';
const SHOTS = path.join(OUT, 'screenshots');
await fs.mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
const base = 'http://127.0.0.1:3486/kanban';
const findings = [];

async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
}

async function addFinding({ id, severity, title, description, expected, actual, repro, evidence }) {
  findings.push({ id, severity, title, description, expected, actual, repro, evidence });
}

try {
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
  await shot('01-home.png');

  // Open settings and switch to pi.
  await page.getByTestId('open-settings-button').click();
  await page.getByRole('dialog').getByText('Settings', { exact: true }).waitFor({ timeout: 10000 });
  await shot('02-settings-open.png');

  const piRow = page.getByRole('button').filter({ hasText: /^pi$/ }).first();
  await piRow.click();
  await shot('03-settings-pi-selected.png');

  const infoText = page.getByText('pi does not expose a permission-bypass/autonomy launch flag; Kanban launches pi without an additional autonomy switch.');
  const infoVisible = await infoText.isVisible().catch(() => false);
  if (!infoVisible) {
    await addFinding({
      id: 'ISSUE-001',
      severity: 'medium',
      title: 'pi settings copy is missing after selecting pi',
      description: 'Selecting pi in Settings should show the pi-specific autonomy note.',
      expected: 'The pi-specific explanatory note is visible in Settings.',
      actual: 'The note did not appear after selecting pi.',
      repro: ['Open Settings', 'Select pi in Agent runtime', 'Observe the autonomy section'],
      evidence: ['02-settings-open.png', '03-settings-pi-selected.png'],
    });
  }

  // Save settings.
  const saveButton = page.getByRole('button', { name: 'Save' }).last();
  await saveButton.click();
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 10000 });
  await shot('04-settings-saved.png');

  // Create a task in backlog.
  const backlog = page.locator('[data-column-id="backlog"]').first();
  await backlog.getByRole('button', { name: 'Create task' }).click();
  const prompt = page.getByPlaceholder('Describe the task');
  const taskTitle = `pi-dogfood-${Date.now()}`;
  await prompt.fill(`Create a tiny markdown file named DOGFOOD_PI_CHECK.md in the repo root with one line saying pi dogfood ok\n\nTask label: ${taskTitle}`);
  await shot('05-create-task-dialog.png');
  await page.keyboard.press('Control+Enter');
  await shot('06-task-created.png');

  // Open the created task and start it.
  const card = page.locator('[data-task-id]').filter({ hasText: taskTitle }).first();
  await card.waitFor({ timeout: 10000 });
  await card.click();
  await shot('07-task-opened.png');

  const startBtn = page.getByRole('button', { name: 'Start', exact: true });
  await startBtn.waitFor({ timeout: 10000 });
  await startBtn.click();
  await shot('08-task-started.png');

  // Observe lifecycle for up to 45s.
  const started = Date.now();
  let sawTerminal = false;
  let sawReview = false;
  let sawFailure = false;
  let failureText = null;

  while (Date.now() - started < 45000) {
    await page.waitForTimeout(1500);

    if (!sawTerminal) {
      const terminalVisible = await page.getByText('Terminal').isVisible().catch(() => false);
      if (terminalVisible) {
        sawTerminal = true;
        await shot('09-terminal-visible.png');
      }
    }

    const reviewVisible = await page.getByText('Waiting for review').isVisible().catch(() => false);
    if (reviewVisible) {
      sawReview = true;
      await shot('10-waiting-for-review.png');
      break;
    }

    const failed = await page.getByText(/Task failed|failed to start|No runnable .* configured|error/i).allTextContents().catch(() => []);
    if (failed.length > 0) {
      sawFailure = true;
      failureText = failed.join(' | ');
      await shot('10-failure-state.png');
      break;
    }
  }

  // Check home sidebar agent surface with pi selected.
  await page.keyboard.press('Escape').catch(() => {});
  await shot('11-after-escape.png');
  const kanbanAgentButton = page.getByRole('button', { name: 'Kanban Agent' });
  if (await kanbanAgentButton.isVisible().catch(() => false)) {
    await kanbanAgentButton.click();
    await page.waitForTimeout(1000);
    await shot('12-home-agent-surface.png');
  }

  if (!sawTerminal) {
    await addFinding({
      id: 'ISSUE-001',
      severity: 'high',
      title: 'Starting a pi task does not expose the expected terminal-backed session',
      description: 'The detail view should show a terminal-backed runtime session for pi after task start.',
      expected: 'A running terminal panel becomes visible and pi session activity is observable.',
      actual: 'No terminal-backed session became visible within 45 seconds.',
      repro: ['Open Settings → select pi → save', 'Create a backlog task', 'Open the task detail view', 'Click Start'],
      evidence: ['07-task-opened.png', '08-task-started.png'],
    });
  }

  if (sawFailure) {
    await addFinding({
      id: findings.length ? `ISSUE-00${findings.length + 1}` : 'ISSUE-001',
      severity: 'high',
      title: 'pi task run fails in live end-to-end flow',
      description: 'The live Kanban runtime reached a visible failure state while running the pi-backed task.',
      expected: 'Task should progress to activity and eventually review.',
      actual: failureText || 'Visible failure state encountered.',
      repro: ['Open Settings → select pi → save', 'Create a backlog task', 'Start the task and wait'],
      evidence: ['08-task-started.png', '10-failure-state.png'],
    });
  }

  if (!sawReview && !sawFailure) {
    await addFinding({
      id: findings.length ? `ISSUE-00${findings.length + 1}` : 'ISSUE-001',
      severity: 'medium',
      title: 'pi task did not reach review within observation window',
      description: 'The live task start path did not visibly complete within 45 seconds.',
      expected: 'A simple task should either complete to review or surface clear progress quickly.',
      actual: 'No visible review completion or explicit failure was observed within the wait window.',
      repro: ['Open Settings → select pi → save', 'Create a simple task', 'Start it and wait 45 seconds'],
      evidence: ['08-task-started.png'],
    });
  }

  const shareFeedback = await page.getByRole('button', { name: 'Share Feedback' }).isVisible().catch(() => false);
  if (!shareFeedback) {
    await addFinding({
      id: findings.length ? `ISSUE-00${findings.length + 1}` : 'ISSUE-001',
      severity: 'low',
      title: 'Share Feedback button not visible on projects sidebar',
      description: 'The Featurebase re-enabled button should be visible in the projects sidebar.',
      expected: 'Share Feedback button is visible.',
      actual: 'Button was not visible in the projects sidebar.',
      repro: ['Open Kanban home screen', 'Look at the projects sidebar footer'],
      evidence: ['01-home.png'],
    });
  }

} finally {
  await browser.close();
}

const summary = {
  critical: findings.filter(f => f.severity === 'critical').length,
  high: findings.filter(f => f.severity === 'high').length,
  medium: findings.filter(f => f.severity === 'medium').length,
  low: findings.filter(f => f.severity === 'low').length,
};

let report = `# Dogfood Report — Kanban pi end-to-end\n\n- Date: 2026-03-27\n- Target: Kanban current checkout\n- Focus: First-class pi support end-to-end\n- Environment: local Linux, live Kanban runtime + real pi binary\n- Base URL: ${base}\n\n## Findings summary\n\n- Critical: ${summary.critical}\n- High: ${summary.high}\n- Medium: ${summary.medium}\n- Low: ${summary.low}\n\n## Issues\n\n`;
if (findings.length === 0) {
  report += 'No end-to-end issues found in this pass.\n';
} else {
  for (const f of findings) {
    report += `### ${f.id}: ${f.title}\n\n`;
    report += `- Severity: ${f.severity}\n`;
    report += `- Description: ${f.description}\n`;
    report += `- Expected: ${f.expected}\n`;
    report += `- Actual: ${f.actual}\n`;
    report += `- Repro:\n`;
    for (const step of f.repro) report += `  1. ${step}\n`;
    report += `- Evidence: ${f.evidence.join(', ')}\n\n`;
  }
}
await fs.writeFile(path.join(OUT, 'report.md'), report, 'utf8');
console.log(JSON.stringify({ findings, summary }, null, 2));
