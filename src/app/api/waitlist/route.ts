import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { name, email, industry } = await request.json();

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get Airtable credentials from environment variables
    const accessToken = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableId = process.env.AIRTABLE_TABLE_ID;

    if (!accessToken || !baseId || !tableId) {
      console.error('Missing Airtable configuration');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Prepare the record data
    const recordData = {
      fields: {
        "Name": name,
        "Email Adress": email,
        "what industry": industry || "" // Optional field
      }
    };

    // Make the API call to Airtable
    const airtableResponse = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recordData),
      }
    );

    if (!airtableResponse.ok) {
      const errorText = await airtableResponse.text();
      console.error('Airtable API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to save to waitlist' },
        { status: 500 }
      );
    }

    const result = await airtableResponse.json();
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Successfully added to waitlist!',
        recordId: result.id 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
}
