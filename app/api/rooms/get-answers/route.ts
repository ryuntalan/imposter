import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getRoomById } from '@/lib/rooms';

// POST /api/rooms/get-answers - Get all answers for the current round in random order
export async function POST(request: Request) {
  try {
    const { roomId } = await request.json();
    
    if (!roomId) {
      return NextResponse.json({
        success: false,
        error: 'Room ID is required'
      }, { status: 400 });
    }
    
    // Get the room to check the current round
    const room = await getRoomById(roomId);
    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Room not found'
      }, { status: 404 });
    }
    
    // Get all answers for this room and round
    const { data: answers, error: answersError } = await supabase
      .from('answers')
      .select(`
        id,
        answer,
        players(id, name)
      `)
      .eq('room_id', roomId)
      .eq('round', room.round_number);
      
    if (answersError) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch answers: ${answersError.message}`
      }, { status: 500 });
    }
    
    // Get all players in the room
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name, is_imposter')
      .eq('room_id', roomId);
      
    if (playersError) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch players: ${playersError.message}`
      }, { status: 500 });
    }
    
    // Check if we're still waiting for answers
    const waitingForAnswers = players && answers && players.length > answers.length;
    
    // Sanitize the answers to hide player identities
    const anonymizedAnswers = answers ? answers.map(answer => ({
      id: answer.id,
      answer: answer.answer
    })) : [];
    
    // Shuffle the answers to randomize the order
    const shuffledAnswers = anonymizedAnswers.sort(() => Math.random() - 0.5);
    
    return NextResponse.json({
      success: true,
      round: room.round_number,
      answers: shuffledAnswers,
      playerCount: players ? players.length : 0,
      answerCount: answers ? answers.length : 0,
      waitingForAnswers,
      allAnswersSubmitted: !waitingForAnswers && answers && answers.length > 0
    });
  } catch (error: any) {
    console.error('Error getting answers:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 