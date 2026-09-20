import { expect, test } from '@playwright/test';

test('creator places a bid and sees the auction result without refreshing', async ({
  page,
  request
}) => {
  const creatorsResponse = await request.get('/api/v1/creators');
  expect(creatorsResponse.ok()).toBeTruthy();
  const creators = (await creatorsResponse.json()) as {
    data: Array<{ id: string; genre: string }>;
  };
  const creator = creators.data[0];
  expect(creator).toBeTruthy();

  const title = `Browser flow ${Date.now()}`;
  const deadline = new Date(Date.now() + 12_000);
  const campaignResponse = await request.post('/api/v1/admin/campaigns', {
    data: {
      title,
      description: 'Playwright end-to-end auction fixture.',
      targetGenre: creator?.genre,
      minimumFollowers: 0,
      targetEngagementRate: '0',
      asset: 'EUR',
      budget: '1000.00',
      biddingDeadline: deadline.toISOString()
    }
  });
  expect(campaignResponse.ok()).toBeTruthy();

  await page.goto(`/creators/${creator?.id}`);
  const campaign = page.getByRole('article').filter({ hasText: title });
  await expect(campaign).toBeVisible();
  await campaign.getByRole('textbox').fill('100.00');
  await campaign.getByRole('button', { name: 'Bid' }).click();
  await expect(campaign.getByText('Bid submitted.')).toBeVisible();

  await page.getByRole('link', { name: 'My bids' }).click();
  const bid = page.getByRole('heading', { name: title }).locator('../..');
  await expect(bid.getByText('Pending')).toBeVisible();

  const waitMs = Math.max(0, deadline.getTime() - Date.now() + 500);
  await page.waitForTimeout(waitMs);
  const closeResponse = await request.post(
    '/api/v1/admin/auctions/process-due'
  );
  expect(closeResponse.ok()).toBeTruthy();
  await expect(bid.getByText('Won')).toBeVisible({ timeout: 15_000 });
});

test('admin navigation remains usable after switching to German', async ({
  page
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Deutsch' }).click();
  await expect(
    page.getByRole('heading', { name: 'Wähle ein Creator-Profil' })
  ).toBeVisible();
  await page.getByRole('link', { name: 'Live-Admin' }).click();
  await expect(page.getByRole('heading', { name: 'Live-Admin' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Neue Kampagne' })).toBeVisible();
});
