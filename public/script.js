const serverUrl = ""; // same origin (Railway URL)
const sampleRate = 16000; // Hz

let audioContext = null;
let audioNode = null;
let ws = null;

// Auto-start listening if listenUrl is provided in the URL (Airtable button case)
window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const listenUrlFromQuery = params.get("listenUrl");

  if (!listenUrlFromQuery) {
    console.log("No listenUrl in query params, normal dialer mode.");
    return;
  }

  console.log("Found listenUrl in query params:", listenUrlFromQuery);

  // Optional: hide the dialer form when opened from Airtable button
  const dialForm = document.getElementById("callForm");
  if (dialForm) {
    dialForm.style.display = "none";
  }

  // Optional: pre-fill a listen URL input if you have one
  const listenInput = document.getElementById("listen-url-input");
  if (listenInput) {
    listenInput.value = listenUrlFromQuery;
  }

  startAudio(listenUrlFromQuery).catch((err) => {
    console.error("Failed to start audio from listenUrl:", err);
    alert("Could not start listening to the call. Check console logs.");
  });
});

// Start streaming audio from a Vapi listenUrl (wss://...)
async function startAudio(listenUrl) {
  // Prevent double-start
  if (ws || audioContext) {
    console.warn("Audio is already playing.");
    return;
  }

  try {
    console.log("Starting audio for listenUrl:", listenUrl);

    // Step 1: Create an AudioContext with the server's sample rate
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate,
    });
    console.log("AudioContext created with sample rate:", sampleRate);

    // Step 2: Load the audioProcessor.js module
    await audioContext.audioWorklet.addModule("audioProcessor.js");
    console.log("AudioProcessor module loaded.");

    // Step 3: Create the AudioWorkletNode and connect it to the destination
    audioNode = new AudioWorkletNode(audioContext, "audio-processor", {
      outputChannelCount: [2], // stereo output
    });
    audioNode.connect(audioContext.destination);
    console.log("AudioWorkletNode connected to destination.");

    // Step 4: Set up the WebSocket connection to receive audio data
    ws = new WebSocket(listenUrl);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      console.log("WebSocket connection opened.");
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const int16Array = new Int16Array(event.data);
        const float32Array = new Float32Array(int16Array.length);

        // Convert 16-bit PCM to Float32 [-1.0, 1.0]
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0;
        }

        // Send the Float32 audio data to the AudioWorkletProcessor
        if (audioNode && audioNode.port) {
          audioNode.port.postMessage({ audioData: float32Array });
        }
      } else {
        console.log("Non-audio message received:", event.data);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed.");
      stopAudio();
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      stopAudio();
    };
  } catch (error) {
    console.error("Error starting audio:", error);
    stopAudio();
  }
}

async function stopAudio() {
  console.log("Stopping audio.");

  if (ws) {
    try {
      ws.close();
    } catch {}
    ws = null;
  }

  if (audioNode) {
    try {
      audioNode.disconnect();
    } catch {}
    audioNode = null;
  }

  if (audioContext) {
    try {
      await audioContext.close();
    } catch {}
    audioContext = null;
  }
}

// Handle call initiation form
const callForm = document.getElementById("callForm");
if (callForm) {
  callForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const phoneNumber = document.getElementById("phoneNumber").value;
    const customerName = document.getElementById("customerName").value;

    try {
      const response = await fetch(`${serverUrl}/initiate-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, customerName }),
      });

      const data = await response.json();

      if (data.success) {
        const listenUrl = data.listenUrl;

        document.getElementById("listenUrl").innerText = listenUrl;
        document.getElementById("liveListening").style.display = "block";
        document.getElementById("callControls").style.display = "block";

        document.getElementById("startListening").onclick = () =>
          startAudio(listenUrl);
        document.getElementById("stopListening").onclick = stopAudio;
        document.getElementById("sendControl").onclick = () =>
          sendControl(listenUrl);

        alert("Call answered! Listen URL is ready.");
      } else {
        alert("Error initiating call: " + data.error);
      }
    } catch (error) {
      console.error("Error initiating call:", error);
      alert("An error occurred while initiating the call.");
    }
  });
}

// Send a control message to the call (optional feature)
async function sendControl(controlUrl) {
  const typeInput = document.getElementById("controlType");
  const messageInput = document.getElementById("controlMessage");

  const type = typeInput ? typeInput.value || "assistant_message" : "assistant_message";
  const message = messageInput ? messageInput.value || "" : "";

  if (!message) {
    alert("Please enter a message to send.");
    return;
  }

  try {
    const response = await fetch(`${serverUrl}/control-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ controlUrl, type, message }),
    });

    const data = await response.json();
    if (data.success) {
      alert("Control message sent successfully.");
    } else {
      alert("Failed to send control message: " + data.error);
    }
  } catch (error) {
    console.error("Error sending control message:", error);
    alert("An error occurred while sending the control message.");
  }
}
