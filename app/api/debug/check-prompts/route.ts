import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

// GET /api/debug/check-prompts
export async function GET() {
  try {
    // Check if prompts table exists
    const { data: tableData, error: tableError } = await supabase
      .from('prompts')
      .select('count(*)')
      .single();
    
    let tableExists = !tableError;
    
    // Try to get a list of prompts
    const { data: prompts, error: promptsError } = await supabase
      .from('prompts')
      .select('id, real_prompt, imposter_prompt')
      .limit(10);
    
    // Try with admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    const { data: adminPrompts, error: adminPromptsError } = await supabaseAdmin
      .from('prompts')
      .select('id, real_prompt, imposter_prompt')
      .limit(10);
    
    return NextResponse.json({
      success: true,
      tableExists,
      tableCount: tableData && 'count' in tableData ? tableData.count : 0,
      prompts: prompts || [],
      adminPrompts: adminPrompts || [],
      errors: {
        tableError: tableError ? tableError.message : null,
        promptsError: promptsError ? promptsError.message : null,
        adminPromptsError: adminPromptsError ? adminPromptsError.message : null
      }
    });
    
  } catch (error: any) {
    console.error('Error checking prompts:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/debug/check-prompts
// Create a sample prompt if none exist
export async function POST() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Check if prompts table exists
    const { data: existingPrompts, error: checkError } = await supabaseAdmin
      .from('prompts')
      .select('id')
      .limit(1);
    
    // Create a sample prompt
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('prompts')
      .insert([
        {
          real_prompt: 'Draw a cat',
          imposter_prompt: 'Draw a dog'
        },
        {
          real_prompt: 'Draw a house',
          imposter_prompt: 'Draw a car'
        },
        {
          real_prompt: 'Describe your favorite food',
          imposter_prompt: 'Describe your least favorite food'
        },
        {
          real_prompt: 'Write a short poem about nature',
          imposter_prompt: 'Write a short poem about technology'
        },
        {
          real_prompt: 'List three superheroes',
          imposter_prompt: 'List three supervillains'
        }
      ]);
    
    return NextResponse.json({
      success: !insertError,
      existingPrompts: existingPrompts || [],
      insertedPrompts: insertData || [],
      error: insertError ? insertError.message : null
    });
    
  } catch (error: any) {
    console.error('Error creating prompts:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 