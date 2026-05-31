import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const allowedMatchTypes = new Set([
  'EXACT_ITEM',
  'CONTAINS_ITEM',
  'CATEGORY',
  'CATEGORY_AND_CONTAINS_ITEM',
  'ARTICLE',
]);

const allowedDepartments = new Set(['all', 'retail', 'wholesale']);
const allowedSaleContexts = new Set(['all', 'credit', 'regular']);
const allowedTargets = new Set([
  'WHOLESALE_EXCLUDED_TECH',
  'WHOLESALE_REVIEW_TECH',
  'WHOLESALE_INCLUDED_1_75',
  'CREDIT_GROSS_PROFIT',
  'CREDIT_ACCESSORY_NO_BONUS',
  'CREDIT_REVIEW_NO_BONUS',
  'RETAIL_REVIEW_TECH',
  'RETAIL_FILM_50',
  'RETAIL_PLOTTER_MATERIAL_COST_50',
  'RETAIL_GROSS_PROFIT_10',
  'RETAIL_ACCESSORY_5',
  'MANUAL_EXCLUDED',
  'REVIEW_ONLY',
]);

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asNullableString(value: unknown) {
  const text = asString(value);
  return text ? text : null;
}

function asNumber(value: unknown, fallback: number) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export async function GET() {
  const rules = await prisma.payrollClassificationRule.findMany({
    orderBy: [{ isActive: 'desc' }, { priority: 'asc' }, { updatedAt: 'desc' }],
  });

  return Response.json(rules);
}

export async function POST(req: Request) {
  const payload = await req.json();
  const matchType = asString(payload.matchType);
  const targetCalculationType = asString(payload.targetCalculationType);
  const department = asString(payload.department, 'all') || 'all';
  const saleContext = asString(payload.saleContext, 'all') || 'all';

  if (!allowedMatchTypes.has(matchType)) {
    return Response.json({ error: 'Invalid matchType.' }, { status: 400 });
  }

  if (!allowedTargets.has(targetCalculationType)) {
    return Response.json({ error: 'Invalid targetCalculationType.' }, { status: 400 });
  }

  if (!allowedDepartments.has(department)) {
    return Response.json({ error: 'Invalid department.' }, { status: 400 });
  }

  if (!allowedSaleContexts.has(saleContext)) {
    return Response.json({ error: 'Invalid saleContext.' }, { status: 400 });
  }

  const itemText = asNullableString(payload.itemText);
  const categoryText = asNullableString(payload.categoryText);
  const article = asNullableString(payload.article);

  if (matchType === 'EXACT_ITEM' && !itemText) {
    return Response.json({ error: 'itemText is required for exact item rule.' }, { status: 400 });
  }

  const existingRule = await prisma.payrollClassificationRule.findFirst({
    where: {
      isActive: true,
      matchType,
      itemText,
      categoryText,
      article,
      department,
      saleContext,
      targetCalculationType,
    },
  });

  if (existingRule) {
    return Response.json(existingRule);
  }

  const rule = await prisma.payrollClassificationRule.create({
    data: {
      title: asNullableString(payload.title),
      isActive: typeof payload.isActive === 'boolean' ? payload.isActive : true,
      priority: asNumber(payload.priority, 100),
      matchType,
      itemText,
      categoryText,
      article,
      department,
      saleContext,
      targetCalculationType,
      reason: asNullableString(payload.reason),
    },
  });

  return Response.json(rule, { status: 201 });
}
