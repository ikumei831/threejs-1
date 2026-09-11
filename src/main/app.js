import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const video = document.getElementById("webcam");
const canvas = document.getElementById("output_canvas");
const ctx = canvas.getContext("2d");

let poseLandmarker;
let handLandmarker;
let lastVideoTime = -1;

// 1. 初始化 MediaPipe 模型
async function initModels() {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
    );

    // 載入 姿態（Pose）模型
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO"
    });

    // 載入 手部（Hand）模型
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker_full.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2 // 最多偵測兩隻手
    });

    startCamera();
}

// 2. 啟動筆電鏡頭
function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
        .then((stream) => {
            video.srcObject = stream;
            video.addEventListener("loadeddata", predictWebcam);
        });
}

// 3. 即時預測與繪製
async function predictWebcam() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;

        // 偵測姿態與手部
        const poseResults = poseLandmarker.detectForVideo(video, startTimeMs);
        const handResults = handLandmarker.detectForVideo(video, startTimeMs);

        // --- 處理姿態數據 (上身) ---
        if (poseResults.landmarks && poseResults.landmarks.length > 0) {
            const pose = poseResults.landmarks[0]; // 第一個人的姿態
            
            // 範例：獲取肩膀的座標 (左肩 ID: 11, 右肩 ID: 12)
            const leftShoulder = pose[11];
            const rightShoulder = pose[12];
            
            // 繪製肩膀（將 0~1 的比例座標轉為畫布像素座標）
            drawPoint(leftShoulder.x * canvas.width, leftShoulder.y * canvas.height, "red");
            drawPoint(rightShoulder.x * canvas.width, rightShoulder.y * canvas.height, "red");
        }

        // --- 處理手指數據 ---
        if (handResults.landmarks && handResults.landmarks.length > 0) {
            for (const hand of handResults.landmarks) {
                // 範例：獲取食指尖 (ID: 8)
                const indexFingerTip = hand[8];
                drawPoint(indexFingerTip.x * canvas.width, indexFingerTip.y * canvas.height, "blue");
                
                // 你可以在這裡遍歷 0~20 個關鍵點並連線
            }
        }
    }
    // 持續循環
    requestAnimationFrame(predictWebcam);
}

function drawPoint(x, y, color) {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

// 啟動程式
const { FilesetResolver, PoseLandmarker, HandLandmarker } = createFilesetResolver ? window : {};
initModels();