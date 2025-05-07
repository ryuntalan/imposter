import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Sample prompts for the game
const SAMPLE_PROMPTS = [
  {
    real_prompt: "Draw a cat",
    imposter_prompt: "Draw a dog"
  },
  {
    real_prompt: "Describe your dream vacation",
    imposter_prompt: "Describe your worst nightmare"
  },
  {
    real_prompt: "Write a haiku about the ocean",
    imposter_prompt: "Write a haiku about the mountains"
  },
  {
    real_prompt: "Draw a superhero",
    imposter_prompt: "Draw a supervillain"
  },
  {
    real_prompt: "Describe your favorite food",
    imposter_prompt: "Describe a food you hate"
  },
  {
    real_prompt: "Draw a house",
    imposter_prompt: "Draw a castle"
  },
  {
    real_prompt: "Write a short poem about friendship",
    imposter_prompt: "Write a short poem about loneliness"
  },
  {
    real_prompt: "Describe what you'd do with a million dollars",
    imposter_prompt: "Describe what you'd do if you were invisible for a day"
  },
  {
    real_prompt: "Draw a tree",
    imposter_prompt: "Draw a flower"
  },
  {
    real_prompt: "Write a joke",
    imposter_prompt: "Write a riddle"
  }
];

// POST /api/debug/seed-prompts - Seed the database with sample prompts
export async function POST() {
  try {
    // Use admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Directly attempt to insert the prompts
    // If the table doesn't exist, this will fail, but we'll try direct table creation below
    const { data: insertedPrompts, error: insertError } = await supabaseAdmin
      .from('prompts')
      .insert(SAMPLE_PROMPTS)
      .select();
      
    if (insertError) {
      // If the error is because the table doesn't exist, try to create it
      if (insertError.message.includes('does not exist')) {
        // Execute SQL to create the table
        const createTableSql = `
          CREATE TABLE IF NOT EXISTS prompts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            real_prompt TEXT NOT NULL,
            imposter_prompt TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `;
        
        try {
          await supabaseAdmin.rpc('exec_sql', { sql: createTableSql });
        } catch (sqlError) {
          console.error('Error executing SQL to create prompts table:', sqlError);
          // Try a direct insert approach
          try {
            // Try a direct insert with just one prompt
            const { error: singleInsertError } = await supabaseAdmin
              .from('prompts')
              .insert({
                real_prompt: "This is a test prompt",
                imposter_prompt: "This is a test imposter prompt"
              });
              
            if (singleInsertError) {
              return NextResponse.json({
                success: false,
                error: `Failed to create prompts table: ${singleInsertError.message}`
              }, { status: 500 });
            }
            
            // If we got here, the table exists, try inserting all prompts
            const { data: finalPrompts, error: finalError } = await supabaseAdmin
              .from('prompts')
              .insert(SAMPLE_PROMPTS)
              .select();
              
            if (finalError) {
              return NextResponse.json({
                success: false,
                error: `Failed to insert prompts after table creation: ${finalError.message}`
              }, { status: 500 });
            }
            
            return NextResponse.json({
              success: true,
              message: `Table created and ${finalPrompts?.length || 0} prompts inserted`,
              insertedCount: finalPrompts?.length || 0
            });
          } catch (directError) {
            return NextResponse.json({
              success: false,
              error: `Failed all attempts to create prompts: ${directError instanceof Error ? directError.message : 'Unknown error'}`
            }, { status: 500 });
          }
        }
        
        // Try inserting the prompts again now that the table should exist
        const { data: retryPrompts, error: retryError } = await supabaseAdmin
          .from('prompts')
          .insert(SAMPLE_PROMPTS)
          .select();
          
        if (retryError) {
          return NextResponse.json({
            success: false,
            error: `Failed to insert prompts after table creation: ${retryError.message}`
          }, { status: 500 });
        }
        
        return NextResponse.json({
          success: true,
          message: `Table created and ${retryPrompts?.length || 0} prompts inserted`,
          insertedCount: retryPrompts?.length || 0
        });
      }
      
      return NextResponse.json({
        success: false,
        error: `Failed to insert prompts: ${insertError.message}`
      }, { status: 500 });
    }
    
    // Get all prompts in the database now
    const { data: allPrompts, error: allPromptsError } = await supabaseAdmin
      .from('prompts')
      .select('id, real_prompt, imposter_prompt');
      
    return NextResponse.json({
      success: true,
      message: `Added ${insertedPrompts?.length || 0} sample prompts`,
      insertedCount: insertedPrompts?.length || 0,
      totalCount: allPrompts?.length || 0
    });
  } catch (error: any) {
    console.error('Error seeding prompts:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 