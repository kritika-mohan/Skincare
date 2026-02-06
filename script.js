// MediaPipe & Camera Setup
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultModal = document.getElementById('resultModal');
const closeBtn = document.getElementsByClassName('close-btn')[0];
const loadingScanner = document.getElementById('loadingScanner');
const aiResponse = document.getElementById('aiResponse');

// OpenRouter Configuration
const OPENROUTER_API_KEY = "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";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function onResults(results) {
    // Draw the overlays.
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw the video frame content first (if we want to render it on canvas)
    canvasCtx.drawImage(
        results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.detections) {
        for (const detection of results.detections) {
            // Draw the bounding box
            drawRectangle(canvasCtx, detection.boundingBox, { color: 'rgba(255, 255, 255, 0.5)', lineWidth: 2, fillColor: 'rgba(255,255,255,0.1)' });

            // We can also draw landmarks if available, but face detection mainly gives box & key landmarks (eyes, nose, mouth, ears)
            drawLandmarks(canvasCtx, detection.landmarks, { color: '#E8B4B8', radius: 3 });
        }
    }
    canvasCtx.restore();
}

const faceDetection = new FaceDetection({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
    }
});

faceDetection.setOptions({
    model: 'short', // or 'full'
    minDetectionConfidence: 0.5
});

faceDetection.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await faceDetection.send({ image: videoElement });
    },
    width: 640,
    height: 480
});

camera.start();

// OpenRouter Integration
analyzeBtn.addEventListener('click', async () => {
    // 1. Capture current frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoElement.videoWidth;
    tempCanvas.height = videoElement.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);

    // Get Base64 image data
    const base64Image = tempCanvas.toDataURL('image/jpeg'); // Includes "data:image/jpeg;base64,"

    // 2. Show Modal & Loading
    resultModal.classList.remove('hidden');
    resultModal.classList.add('show');
    loadingScanner.classList.remove('hidden');
    aiResponse.innerHTML = '';

    try {
        // 3. Call OpenRouter API
        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                // "HTTP-Referer": window.location.href, // Optional
                // "X-Title": "DermaGlow AI" // Optional
            },
            body: JSON.stringify({
                "model": "openai/gpt-4o-mini", // Using a Vision-capable model
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Analyze this image of a face for skincare purposes. Identify skin type (e.g., oily, dry, combination), any visible concerns (e.g., acne, pores, dark circles), and recommend a simple 3-step skincare routine. Format the response in simple HTML (using <h3>, <p>, <ul>, <li>) suitable for a div. Do not use markdown backticks."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": base64Image
                                }
                            }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.choices[0].message.content;

        // 4. Display Results
        loadingScanner.classList.add('hidden');
        aiResponse.innerHTML = text;

    } catch (error) {
        console.error("OpenRouter Error:", error);
        loadingScanner.classList.add('hidden');
        aiResponse.innerHTML = `<p style='color:red;'>Error: ${error.message || "Unknown error"}. <br> Check console for details.</p>`;
    }
});

// Close Modal Logic
closeBtn.onclick = function () {
    resultModal.classList.remove('show');
    setTimeout(() => {
        resultModal.classList.add('hidden');
    }, 300); // Wait for transition
}

window.onclick = function (event) {
    if (event.target == resultModal) {
        resultModal.classList.remove('show');
        setTimeout(() => {
            resultModal.classList.add('hidden');
        }, 300);
    }
}
