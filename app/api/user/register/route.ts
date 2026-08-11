import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import bcrypt from "bcryptjs";


export async function POST(req: Request) {
  try {

    const body = await req.json();

    const { auth_user_id, company_name, cnpj, email, phone, name, password } = body || {};

    if (!auth_user_id || !company_name || !email || !name) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const admin = createServerClient();
    console.log(admin);
    
    if (!admin) {
      return NextResponse.json({ error: 'Failed to initialize server client.' }, { status: 500 });
    }

    // Create the org
    const { data: org, error: orgErr } = 
    await admin
    .from('org')
    .insert({ company_name, cnpj: cnpj ?? null, email, phone: phone ?? null })
    .select('id')
    .single();

    if (orgErr) throw new Error(orgErr.message);

    //creating password to tenant table manually
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    // Create the master tenant linked to the auth user + new org
    const { error: tenantErr } = await admin.from('tenant').insert({
      name,
      email,
      password: hash,
      auth_user_id,
      org_id: org.id,
      is_master: true,
    });

    if (tenantErr) throw new Error(tenantErr.message);

    return NextResponse.json({ ok: true, org_id: org.id });
    
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
