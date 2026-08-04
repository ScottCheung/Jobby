import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

const filePath = path.join(process.cwd(), 'app', 'test-autofill', 'test-fields.json');

async function readConfig(): Promise<Record<string, unknown>> {
  const content = await fs.readFile(filePath, 'utf8');
  const parsed: unknown = JSON.parse(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Test field JSON must contain an object.');
  }
  return parsed as Record<string, unknown>;
}

export async function GET() {
  try {
    return NextResponse.json(await readConfig(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not read test field JSON.' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const current = await readConfig();
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid test field JSON.' }, { status: 400 });
    }
    const activeQuestions = (body as { activeQuestions?: unknown }).activeQuestions;
    if (!Array.isArray(activeQuestions)) {
      return NextResponse.json({ error: 'activeQuestions must be an array.' }, { status: 400 });
    }
    current.activeQuestions = activeQuestions;
    await fs.writeFile(filePath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
    return NextResponse.json(current, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not write test field JSON.' },
      { status: 500 },
    );
  }
}
