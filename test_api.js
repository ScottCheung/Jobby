

async function test() {
  try {
    const payload = {
      title: 'Test Question',
      difficulty: 'Medium',
      importance_score: 3,
      answer_objective: '',
      answer_framework: ''
    };

    console.log("Sending payload:", JSON.stringify(payload));
    
    // Assuming backend is on port 8000
    const res = await fetch('http://localhost:8000/api/interview/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Mock a user via header if the backend depends on it? 
        // Actually the backend uses get_or_create_current_user, which might need Authorization header.
        // Let's see if we can get a 401 or a 422.
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

test();
