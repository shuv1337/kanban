import { chromium } from 'playwright';
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

async function addFinding(f) { findings.push(f); }

try {
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
  await shot('01-home.png');

  // Dismiss startup onboarding if present.
  const onboardingDone = page.getByRole('button', { name: 'Done' });
  const onboardingNext = page.getByRole('button', { name: 'Next' });
  if (await onboardingNext.isVisible().catch(() => false) || await onboardingDone.isVisible().catch(() => false)) {
    for (let i = 0; i < 5; i += 1) {
      if (await onboardingDone.isVisible().catch(() => false)) {
        await onboardingDone.click();
        break;
      }
      if (await onboardingNext.isVisible().catch(() => false)) {
        await onboardingNext.click();
        await page.waitForTimeout(250);
      }
    }
    await page.waitForTimeout(500);
    await shot('01b-onboarding-dismissed.png');
  }

  await page.getByTestId('open-settings-button').click();
  await page.getByRole('dialog').getByText('Settings', { exact: true }).waitFor({ timeout: 10000 });
  await shot('02-settings-open.png');

  const piLabel = page.getByText(/^pi$/).first();
  await piLabel.click();
  await shot('03-settings-pi-selected.png');

  const infoVisible = await page.getByText('pi does not expose a permission-bypass/autonomy launch flag; Kanban launches pi without an additional autonomy switch.').isVisible().catch(() => false);
  if (!infoVisible) {
    await addFinding({
      id: 'ISSUE-001', severity: 'medium', title: 'pi settings copy missing',
      description: 'Selecting pi should show pi-specific autonomy copy.',
      expected: 'pi note is visible in Settings.', actual: 'pi note was not visible.',
      repro: ['Open Settings', 'Select pi in Agent runtime'], evidence: ['02-settings-open.png','03-settings-pi-selected.png']
    });
  }

  const saveButton = page.getByRole('button', { name: 'Save' }).last();
  const saveEnabled = await saveButton.isEnabled().catch(() => false);
  if (saveEnabled) {
    await saveButton.click();
  } else {
    await page.keyboard.press('Escape').catch(() => {});
  }
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 10000 });
  await shot('04-settings-saved.png');

  const backlog = page.locator('[data-column-id="backlog"]').first();
  await backlog.getByRole('button', { name: 'Create task' }).click();
  const prompt = page.getByPlaceholder('Describe the task');
  const taskTitle = `pi-dogfood-${Date.now()}`;
  await prompt.fill(`Create a tiny markdown file named DOGFOOD_PI_CHECK.md in the repo root with one line saying pi dogfood ok\n\nTask label: ${taskTitle}`);
  await shot('05-create-task-dialog.png');
  await page.keyboard.press('Control+Enter');
  await shot('06-task-created.png');

  const card = page.locator('[data-column-id="backlog"] [data-task-id]').first();
  await card.waitFor({ timeout: 10000 });
  await card.click();
  await shot('07-task-opened.png');

  const startBtn = page.getByRole('button', { name: 'Start', exact: true });
  await startBtn.waitFor({ timeout: 10000 });
  await startBtn.click();
  await shot('08-task-started.png');

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
      id: findings.length ? `ISSUE-00${findings.length + 1}` : 'ISSUE-001', severity: 'high', title: 'pi task start did not expose terminal session',
      description: 'Detail view should show a terminal-backed pi session after start.',
      expected: 'Terminal panel becomes visible.', actual: 'No terminal panel became visible within 45 seconds.',
      repro: ['Select pi in Settings', 'Create task', 'Open task', 'Click Start'], evidence: ['07-task-opened.png','08-task-started.png']
    });
  }
  if (sawFailure) {
    await addFinding({
      id: findings.length ? `ISSUE-00${findings.length + 1}` : 'ISSUE-001', severity: 'high', title: 'pi task run fails in live flow',
      description: 'Live runtime reached visible failure state while running pi task.',
      expected: 'Task should progress to activity and/or review.', actual: failureText || 'Visible failure state encountered.',
      repro: ['Select pi in Settings', 'Create task', 'Start task and wait'], evidence: ['08-task-started.png','10-failure-state.png']
    });
  }
  if (!sawReview && !sawFailure) {
    await addFinding({
      id: findings.length ? `ISSUE-00${findings.length + 1}` : 'ISSUE-001', severity: 'medium', title: 'pi task did not complete within observation window',
      description: 'Simple live pi task did not visibly reach review within 45 seconds.',
      expected: 'Task should complete or clearly progress.', actual: 'No visible review completion or explicit failure within 45 seconds.',
      repro: ['Select pi in Settings', 'Create simple task', 'Start task and wait 45 seconds'], evidence: ['08-task-started.png']
    });
  }

  const shareFeedback = await page.getByRole('button', { name: 'Share Feedback' }).isVisible().catch(() => false);
  if (!shareFeedback) {
    await addFinding({
      id: findings.length ? `ISSUE-00${findings.length + 1}` : 'ISSUE-001', severity: 'low', title: 'Share Feedback button not visible',
      description: 'Featurebase re-enabled button should be visible on sidebar.',
      expected: 'Share Feedback button visible.', actual: 'Button was not visible.',
      repro: ['Open Kanban home screen', 'Inspect projects sidebar footer'], evidence: ['01-home.png']
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
