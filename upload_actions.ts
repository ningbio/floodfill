import { AxiosError, AxiosResponse } from 'axios';
import { MIME_TYPES } from 'src/constants/general_constants';
import { Action, Dispatch } from 'redux';
import { UploadedAsset } from 'src/models/uploaded-asset';
import { NotificationAction } from 'src/reducers/reducer_notification';
import { requestAxios_DEPRECATED } from 'src/utils/request';
import { uploadImageFile, verifyAndFixSVGImageFile } from 'src/utils/uploads-handler';
import { SUPPORTED_FILES_TO_UPLOAD } from '../components/tool/common/library_constants';
import { PARENT_CATEGORY_MODE } from '../constants/action_constants';
import { MESSAGE_CONSTANTS } from '../constants/message_constants';
import { API_URL_CONSTANTS } from '../constants/redux_action_constants';
import { addSpinner, removeSpinner, SpinnerActions } from '../utils/spinner';
import { addNotification } from './notification_actions';
var ort = require('./../../node_modules/onnxruntime-web');


const ROOT_URL = API_URL_CONSTANTS.ROOT_URL_UPLOADS;

export enum UPLOAD_ACTION {
    NEW_UPLOADED_ASSET_IN_PROGRESS = 'new_uploaded_asset_in_progress',
    NEW_UPLOADED_ASSET = 'new_uploaded_asset',
    CLEAR_MY_UPLOADS_BADGE = 'clear_my_uploads_badge',
    UPLOAD_IMAGES = 'upload_images',
    FETCH_UPLOADED_ASSETS = 'fetch_uploaded_assets',
    FETCH_UPLOADED_ASSETS_SHARED_WITH_TEAM = 'fetch_uploaded_assets_shared_with_team',
    NEW_TEAM_ASSET_IN_PROGRESS = 'new_team_asset_in_progress',
    STOP_SHARING_UPLOADED_ASSET_WITH_MY_TEAM = 'stop_sharing_uploaded_asset_with_my_team',
    EDIT_NAME_UPLOADED_ASSET = 'edit_name_uploaded_asset',
    MARK_SHARED_UPLOAD = 'mark_shared_upload',
    MARK_DELETED_UPLOAD = 'mark_deleted_upload',
    CANCEL_UPLOADING_IMAGES = 'cancel_uploading_images',
}

interface UploadAssetInProgressAction extends Action<UPLOAD_ACTION> {
    type: UPLOAD_ACTION.NEW_UPLOADED_ASSET_IN_PROGRESS;
}

interface NewUploadAssetAction extends Action<UPLOAD_ACTION> {
    type: UPLOAD_ACTION.NEW_UPLOADED_ASSET;
    data: UploadedAsset;
}

interface ClearMyUploadsBadgeAction extends Action<UPLOAD_ACTION> {
    type: UPLOAD_ACTION.CLEAR_MY_UPLOADS_BADGE;
}

interface UploadImagesAction extends Action<UPLOAD_ACTION> {
    type: UPLOAD_ACTION.UPLOAD_IMAGES;
    data: {
        imagesData: { filename: string; data: string }[];
        unsupportedFiles: string[];
        onFinishFunction?: (results: { imageUrls?: string[]; imageInfos?: UploadedAsset[] }) => void;
    };
}

interface FetchUploadedAssetsAction extends Action<UPLOAD_ACTION> {
    type: UPLOAD_ACTION.FETCH_UPLOADED_ASSETS;
    uploads: UploadedAsset[];
}

interface FetchUploadedAssetsSharedWithTeamAction extends Action<UPLOAD_ACTION> {
    type: UPLOAD_ACTION.FETCH_UPLOADED_ASSETS_SHARED_WITH_TEAM;
    uploads: UploadedAsset[];
}

interface ShareUploadWithMyTeamAction extends Action<UPLOAD_ACTION> {
    type: UPLOAD_ACTION.NEW_TEAM_ASSET_IN_PROGRESS;
}

interface MarkSharedUploadAction extends Action<UPLOAD_ACTION> {
    type: UPLOAD_ACTION.MARK_SHARED_UPLOAD;
    data: UploadedAsset;
}

interface StopSharingUploadWithMyTeamAction extends Action<UPLOAD_ACTION> {
    type: UPLOAD_ACTION.STOP_SHARING_UPLOADED_ASSET_WITH_MY_TEAM;
    data: UploadedAsset;
}
interface EditNameOfUploadedAssetAction extends Action<UPLOAD_ACTION> {
    type: UPLOAD_ACTION.EDIT_NAME_UPLOADED_ASSET;
    data: UploadedAsset;
}

interface DeleteUploadedAssetAction extends Action<UPLOAD_ACTION> {
    type: UPLOAD_ACTION.MARK_DELETED_UPLOAD;
    _id: string;
}

interface CancelUploadingImagesAction extends Action<UPLOAD_ACTION> {
    type: UPLOAD_ACTION.CANCEL_UPLOADING_IMAGES;
}

export type UploadAssetActions =
    | UploadAssetInProgressAction
    | NewUploadAssetAction
    | ClearMyUploadsBadgeAction
    | UploadImagesAction
    | FetchUploadedAssetsAction
    | FetchUploadedAssetsSharedWithTeamAction
    | ShareUploadWithMyTeamAction
    | MarkSharedUploadAction
    | StopSharingUploadWithMyTeamAction
    | EditNameOfUploadedAssetAction
    | DeleteUploadedAssetAction
    | CancelUploadingImagesAction;

export function uploadAsset(
    { name, image, tags }: Partial<UploadedAsset>,
    onSuccess: (UploadedAsset) => any,
    onFailure: (error) => void,
    parentCategory: PARENT_CATEGORY_MODE,
) {
    return (dispatch: Dispatch<UploadAssetActions | SpinnerActions>) => {
        const message = MESSAGE_CONSTANTS.UPLOAD_ASSET;
        dispatch({
            type: UPLOAD_ACTION.NEW_UPLOADED_ASSET_IN_PROGRESS,
        });
        uploadImageFile(
            { name, image, tags },
            (upload) => {
                dispatch({
                    type: UPLOAD_ACTION.NEW_UPLOADED_ASSET,
                    data: upload,
                });
                onSuccess(upload);
                if (parentCategory && parentCategory === PARENT_CATEGORY_MODE.UPLOAD) {
                    dispatch({
                        type: UPLOAD_ACTION.CLEAR_MY_UPLOADS_BADGE,
                        data: [],
                    });
                }
            },
            onFailure,
            () => removeSpinner({ dispatch, message }),
        );
    };
}

export function handleUploadingImages({
    files,
    onFinishFunction,
    onFailure,
    // @ts-ignore
    showUploadForm = true,
}: {
    files: File[];
    onFinishFunction?: (results: { imageUrls?: string[]; imageInfos?: UploadedAsset[] }) => void;
    onFailure?: (error: string, filename?: string) => void;
    showUploadForm?: boolean;
}) {
    return (dispatch: Dispatch<UploadAssetActions | SpinnerActions>) => {
        let counter = files.length;
        const imagesData: { filename: string; data: string }[] = [];
        const unsupportedFiles: string[] = [];

        const message = MESSAGE_CONSTANTS.PROCESSING_IMAGE;

        // Helper function for processing each file.
        const completeFileUpload = async () => {
            counter -= 1; // this means all readers have loaded
            if (counter === 0) {
                // if (!showUploadForm) {
                // uploads all files, files here have already been checked for being of correct extension and file size
                const newUploads: UploadedAsset[] = [];
                await Promise.all(
                    imagesData.map((image) =>
                        uploadImageFile(
                            { name: image.filename, image: image.data },
                            (upload) => {
                                newUploads.push(upload);
                                dispatch({
                                    type: UPLOAD_ACTION.NEW_UPLOADED_ASSET,
                                    data: upload,
                                });
                            },
                            (error) => {
                                if (onFailure && error.data) {
                                    onFailure(error.data, image.filename);
                                }
                            },
                            () => removeSpinner({ dispatch, message: MESSAGE_CONSTANTS.UPLOAD_ASSET }),
                        ),
                    ),
                );
                removeSpinner({ dispatch, message });
                if (newUploads.length && onFinishFunction) {
                    onFinishFunction({ imageInfos: newUploads });
                }
                // } else {
                //     dispatch({
                //         type: UPLOAD_ACTION.UPLOAD_IMAGES,
                //         data: { imagesData, unsupportedFiles, onFinishFunction },
                //     });
                // }
            }
            removeSpinner({ dispatch, message });
        };

        addSpinner({ dispatch, message, blockLoader: false });

        Array.from(files).forEach((file) => {
            if (SUPPORTED_FILES_TO_UPLOAD.indexOf(file.type) === -1) {
                unsupportedFiles.push(file.name);
                completeFileUpload();
            } else {
                const reader = new FileReader();
                reader.onload = (event) => {
                    let imageData: string = event?.target?.result as string;

                    if (imageData) {
                        if (file.type === MIME_TYPES.SVG) {
                            imageData = verifyAndFixSVGImageFile(imageData);
                        }

                        // alert(`before we finish uploading, we would like to do some editing!`);
                        let alpgaDg: HTMLDialogElement | null = document.getElementById('alphaDialog');
                        if (!alpgaDg) {
                            const div = document.createElement('div');                            
                            div.innerHTML = `<dialog id="alphaDialog" style="background-image: url('/assets/checker.jpg');"> <form method="dialog">

                                <p>Select Erasing Mode:</p>
                                <div>
                                <input type="radio" id="manual" name="mode" value="manual">
                                <label for="manual">Manual</label>
                                <input type="radio" id="semi" name="mode" value="semi" checked>
                                <label for="semi">Semi-Automatic</label>
                                <input type="radio" id="auto" name="mode" value="auto">
                                <label for="auto">Automatic</label>
                                <button id="oneclick" disabled>Start Auto</button>
                                <button id="done">Done</button>
                                </div>
                            
                                <table>
                                <thead>
                                    <tr>
                                    <th>source</th>
                                    <th>zoomed pixels</th>
                                    <th>processed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                    <td>
                                        <canvas id="alphaCanvas0" width="200" height="200"></canvas>
                                    </td>
                                    <td align="center">
                                        <canvas id="pixelated-zoom" width="200" height="200"></canvas>
                                    </td>
                                    <td align="center">
                                        <canvas id="processed" width="200" height="200"></canvas>
                                    </td>
                                    </tr>
                                </tbody>
                                <table>
                            </form></dialog>
                            `;
                            
                            document.body.appendChild(div);
                            alpgaDg = document.getElementById('alphaDialog');
                        }

                        alpgaDg?.showModal();
                        
                        // now the html is ready, add event listeners
                    
                        let erasingMode = 'semi';

                        // main canvas
                        let canvas : HTMLCanvasElement = document.getElementById('alphaCanvas0')! as HTMLCanvasElement;
                        var ctx = canvas.getContext('2d')!as CanvasRenderingContext2D;
                
                        // zoomed canvas
                        var pixelatedZoomCtx = (document.getElementById('pixelated-zoom')!as HTMLCanvasElement).getContext('2d') as CanvasRenderingContext2D;
                        pixelatedZoomCtx.imageSmoothingEnabled = false;
                        pixelatedZoomCtx.mozImageSmoothingEnabled = false;
                        pixelatedZoomCtx.webkitImageSmoothingEnabled = false;
                        pixelatedZoomCtx.msImageSmoothingEnabled = false;
                
                        // processed
                        var processedCanvas = document.getElementById('processed')! as HTMLCanvasElement;
                        var processedCtx = processedCanvas.getContext('2d') as CanvasRenderingContext2D;
                
                        // orignal image data (buffer), used to query pixel value
                        let imageData0: ImageData;
                        let curAlphaData:ImageData;
                        let tmpData:ImageData;
                
                        // load image
                        var img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.src = imageData;                       
                    
                        img.onload = function () {
                            console.log(`${img.width} ${img.height}`);
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx.drawImage(img, 0, 0);
                            
                            processedCanvas.width = img.width;
                            processedCanvas.height = img.height;
                            processedCtx.drawImage(img, 0, 0);
                
                            // console.log(`w = ${img.width} h = ${img.height}`);
                            imageData0 = ctx.getImageData(0, 0, img.width, img.height);
                
                            // transparent black image, used to store alpha
                            curAlphaData = ctx.createImageData(imageData0);
                            tmpData = ctx.createImageData(imageData0);
                
                            for (let i = 0; i < imageData0.data.length; i += 4) {
                                // Modify pixel data
                                curAlphaData.data[i + 0] = imageData0.data[i + 0];
                                curAlphaData.data[i + 1] = imageData0.data[i + 1];
                                curAlphaData.data[i + 2] = imageData0.data[i + 2];
                                curAlphaData.data[i + 3] = imageData0.data[i + 3];
                            }                    
                        };
                        
                        // The Uint8ClampedArray contains height × width × 4 bytes of data, with index values ranging from 0 to (height×width×4)-1.
                        const getPixelValue = function (img, x, y) {
                            if (x < 0 || y < 0 || x >= img.width || y >= img.height) console.error(`getPixelValue out of range!`);
                            const index = 4 * (y * img.width + x);
                            return [img.data[index + 0], img.data[index + 1], img.data[index + 2], img.data[index + 3]];
                        }
                
                        var drawEyeDroper = function (ctx, x, y) {
                            const r = 4;
                            const w = r * 2 + 1;
                            const sw = 200; // scaled width in pixel
                            ctx.drawImage(canvas,
                            Math.min(Math.max(0, x - r), img.width - w),
                            Math.min(Math.max(0, y - r), img.height - w),
                            w, w,
                            0, 0,
                            sw, sw);
                
                            // ui to make the pixel more visible
                            const pw = sw / w;
                            const hw = pw / 2;
                            const cx = sw / 2;
                            const cy = sw / 2;
                            ctx.strokeStyle = 'black';
                            ctx.strokeRect(cx - hw - 1, cy - hw - 1, pw + 2, pw + 2);
                            ctx.strokeStyle = 'white';
                            ctx.strokeRect(cx - hw, cy - hw, pw, pw);
                
                            ctx.beginPath();
                            const len = sw / 4;
                            ctx.moveTo(sw / 2, 0);
                            ctx.lineTo(sw / 2, len);
                
                            ctx.moveTo(sw, sw / 2);
                            ctx.lineTo(sw - len, sw / 2);
                
                            ctx.moveTo(sw / 2, sw);
                            ctx.lineTo(sw / 2, sw - len);
                
                            ctx.moveTo(0, sw / 2);
                            ctx.lineTo(len, sw / 2);
                            ctx.stroke();
                        };
                
                        // floodfill and modify img in-place          
                        function floodfill(data, x, y, fillcolor, tolerance, width) {
                            var length = data.length;
                            var Q = [];
                            var i = (x + y * width) * 4; // seed position
                            var e = i, w = i, me, mw, w2 = width * 4;
                
                            var targetcolor = [data[i], data[i + 1], data[i + 2], data[i + 3]];
                
                            if (!pixelCompare(i, targetcolor, fillcolor, data, length, tolerance)) { return false; }
                            Q.push(i);
                            while (Q.length) {
                            i = Q.pop();
                            if (pixelCompareAndSet(i, targetcolor, fillcolor, data, length, tolerance)) {
                                e = i;
                                w = i;
                                mw = parseInt(i / w2) * w2; //left bound
                                me = mw + w2;             //right bound
                                while (mw < w && mw < (w -= 4) && pixelCompareAndSet(w, targetcolor, fillcolor, data, length, tolerance)); //go left until edge hit
                                while (me > e && me > (e += 4) && pixelCompareAndSet(e, targetcolor, fillcolor, data, length, tolerance)); //go right until edge hit
                                for (var j = w + 4; j < e; j += 4) {
                                if (j - w2 >= 0 && pixelCompare(j - w2, targetcolor, fillcolor, data, length, tolerance)) Q.push(j - w2); //queue y-1
                                if (j + w2 < length && pixelCompare(j + w2, targetcolor, fillcolor, data, length, tolerance)) Q.push(j + w2); //queue y+1
                                }
                            }
                            }
                            return data;
                        };
                
                        // fillcolor is the color you want to assign
                        function pixelCompare(i, targetcolor, fillcolor, data, length, tolerance) {
                            if (i < 0 || i >= length) return false; //out of bounds
                            if (data[i + 3] === 0 && fillcolor.a > 0) return true;  //surface is invisible and fill is visible
                
                            if (
                            Math.abs(targetcolor[3] - fillcolor.a) <= tolerance &&
                            Math.abs(targetcolor[0] - fillcolor.r) <= tolerance &&
                            Math.abs(targetcolor[1] - fillcolor.g) <= tolerance &&
                            Math.abs(targetcolor[2] - fillcolor.b) <= tolerance
                            ) return false; //target is same as fill
                
                            if (
                            Math.abs(targetcolor[3] - data[i + 3]) <= (255 - tolerance) &&
                            Math.abs(targetcolor[0] - data[i]) <= tolerance &&
                            Math.abs(targetcolor[1] - data[i + 1]) <= tolerance &&
                            Math.abs(targetcolor[2] - data[i + 2]) <= tolerance
                            ) return true; //target to surface within tolerance
                
                            return false; //no match
                        };
                
                        // if is similar color, set the color to data
                        function pixelCompareAndSet(i, targetcolor, fillcolor, data, length, tolerance) {
                            if (pixelCompare(i, targetcolor, fillcolor, data, length, tolerance)) {
                            //fill the color
                            data[i] = fillcolor.r;
                            data[i + 1] = fillcolor.g;
                            data[i + 2] = fillcolor.b;
                            data[i + 3] = fillcolor.a;
                            return true;
                            }
                            return false;
                        };
                
                        // Compare colors as difference in contrast
                        // See: https://www.w3.org/TR/AERT/#color-contrast
                        // function isSameColor(a, b, tolerance = 0) {
                        //   brightnessA = (299 * a.r + 587 * a.g + 114 * a.b) / 1000
                        //   brightnessB = (299 * b.r + 587 * b.g + 114 * b.b) / 1000
                        //   return Math.abs(brightnessA - brightnessB) <= tolerance;
                        // }
                
                        // Hard-erasing, set circlular area pixels around (x,y) to transparent, modify the img directly
                        function hardErase(img, cx, cy, r, feather = 0) {
                            const r2 = r * r;
                            for (let x = cx - r; x <= cx + r; x++) {
                            for (let y = cy - r; y <= cy + r; y++) {
                                if (x < 0 || x >= img.width || y < 0 || y >= img.height) continue;
                                const dis2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
                                if (dis2 <= r2) {
                                const index = (y * img.width + x) * 4;
                                img.data[index + 0] = 0;
                                img.data[index + 1] = 0;
                                img.data[index + 2] = 0;
                                img.data[index + 3] = 0;
                                }
                                // feathering:
                                if (feather > 0) {}
                            }
                            }
                        }
                
                        let isDragging = false;
                        let lastX = undefined;
                        let lastY = undefined;
                        let seedX = undefined;
                        let seedY = undefined;
                        let selectedColor = undefined; // [r,g,b,a]
                        const maxDragDistane = 200.0;
                
                        // when mouse down, thresh is set
                        canvas.addEventListener('mousedown', function (e) {
                            selectedColor = getPixelValue(imageData0, e.layerX, e.layerY);
                            isDragging = true;
                
                            seedX = e.layerX;
                            seedY = e.layerY;
                
                            lastX = e.layerX;
                            lastY = e.layerY;
                        });
                
                        canvas.addEventListener('mouseup', function (e) {
                            isDragging = false;
                            selectedColor = undefined;
                
                            // bake tmpData to current result dst.data.set(src.data);
                            if (erasingMode === 'semi' && seedX && seedY) {
                            curAlphaData.data.set(tmpData.data);
                
                            seedX = undefined;
                            seedY = undefined;
                            }
                
                            lastX = e.layerX;
                            lastY = e.layerY;
                        });
                
                        canvas.addEventListener('mousemove', function (e) {
                            const x = e.layerX;
                            const y = e.layerY;
                
                            if (erasingMode === 'semi' || erasingMode === 'manual') {
                                drawEyeDroper(pixelatedZoomCtx, x, y);
                            }
                                
                            if (isDragging) {
                            if (erasingMode === 'semi' && seedX && seedY) {
                                const dis = Math.sqrt((e.layerX - lastX) * (e.layerX - lastX) + (e.layerY - lastY) * (e.layerY - lastY));
                                const disRatio = Math.min(dis / maxDragDistane, 1);
                
                                // fetch current image data
                                for (let i = 0; i < curAlphaData.data.length; i += 4) {
                                tmpData.data[i + 0] = curAlphaData.data[i + 0];
                                tmpData.data[i + 1] = curAlphaData.data[i + 1];
                                tmpData.data[i + 2] = curAlphaData.data[i + 2];
                                tmpData.data[i + 3] = curAlphaData.data[i + 3];
                                }
                
                                // flood and generate some transparent pixels save to a new imagedata
                                const tol = parseInt(255.0 * disRatio);
                                console.log(`drag ratio = ${disRatio} tol = ${tol}`);
                
                                // set flooded pixels to transparent directly
                                floodfill(tmpData.data, seedX, seedY, { r: 0, g: 0, b: 0, a: 0 }, tol, tmpData.width);
                                processedCtx.putImageData(tmpData, 0, 0);
                
                            } else if (erasingMode === 'manual') {
                                hardErase(curAlphaData, x, y, 10);
                                processedCtx.putImageData(curAlphaData, 0, 0);
                
                            } else {
                                // todo: automatic
                            }
                            console.log(processedCanvas.toDataURL());
                            }
                        });
                
                        document.getElementById('auto')!.addEventListener('click', (e) => {
                            erasingMode = 'auto';
                            console.log(erasingMode);
                            document.getElementById('oneclick')!.disabled = false;
                        });
                        document.getElementById('semi')!.addEventListener('click', (e) => {
                            erasingMode = 'semi';
                            console.log(erasingMode);
                            document.getElementById('oneclick')!.disabled = true;
                        });
                        document.getElementById('manual')!.addEventListener('click', (e) => {
                            erasingMode = 'manual';
                            console.log(erasingMode);
                            document.getElementById('oneclick')!.disabled = true;
                        });
                        document.getElementById('oneclick')!.addEventListener('click', async (e) => {
                            event.preventDefault();                            
                            console.log(`oneclick`);

                            const session = await ort.InferenceSession.create('/assets/u2netp.onnx').then(console.log("model loaded"));
                            const u2width = 320; // this is fixed by u2net
                            var oc = document.createElement('canvas');
                            var octx = oc.getContext('2d')!;
                            oc.width = u2width;
                            oc.height = u2width;
                            // use drawImage to do resizing!
                            octx.drawImage(canvas, 0, 0, oc.width, oc.height);
                            var input_imageData = octx.getImageData(0, 0, u2width, u2width);
                            console.log("input_imageData", input_imageData.data)
                
                            // data has to be r-plane, g-plane, b-plane and necessary image normalization (x-mean)/std, (mean,std) is from imagenet
                            var imagePlanes = new Float32Array(u2width * u2width * 3);
                            const planeSize = u2width * u2width;
                            const mean = [0.485, 0.456, 0.406];
                            const std = [0.229, 0.224, 0.225];
                            for (let i = 0; i < u2width; i++) {
                              for (let j = 0; j < u2width; j++) {
                                const idx = i * u2width + j;
                                for (let k = 0; k < 3; k++) {
                                  imagePlanes[k * planeSize + idx] = (input_imageData.data[4 * idx + k] / 255.0 - mean[k]) / std[k];//floatArr[3 * idx + k];
                                }
                              }
                            }
                
                            console.log(`wait for background calculation...`);
                            var startTime = performance.now();
                            const input = new ort.Tensor('float32', imagePlanes, [1, 3, u2width, u2width]);
                            const feeds = { "input.1": input };
                            const results = await session.run(feeds).then();
                            console.log(`background calculation finished!!!`);
                            const pred = Object.values(results)[0];
                            console.log(`calculation ${((performance.now() - startTime) / 1000).toFixed(2)} seconds`);
                
                            // write result
                            let resultCanvas = document.createElement('canvas');
                            resultCanvas.width = u2width;
                            resultCanvas.height = u2width;
                            const resultCtx = resultCanvas.getContext("2d");
                            const resultData = resultCtx.getImageData(0, 0, u2width, u2width);
                            for (let i = 0; i < pred.data.length * 4; i += 4) {
                              const t = i / 4;
                              resultData.data[i + 0] = Math.round(pred.data[t] * 255);
                              resultData.data[i + 1] = Math.round(pred.data[t] * 255);
                              resultData.data[i + 2] = Math.round(pred.data[t] * 255);
                              resultData.data[i + 3] = 255;
                            }
                            resultCtx.putImageData(resultData, 0, 0);
                
                            // now draw the resultCanvas on to canvas to implement 'resize'
                            processedCtx.drawImage(resultCanvas, 0, 0, canvas.width, canvas.height);
                
                            // refill rgb from source image
                            const finalData = processedCtx.getImageData(0, 0, canvas.width, canvas.height);
                            for (let i = 0; i < imageData0.data.length; i += 4) {
                              finalData.data[i + 3] = finalData.data[i + 0];
                              finalData.data[i + 0] = imageData0.data[i + 0];
                              finalData.data[i + 1] = imageData0.data[i + 1];
                              finalData.data[i + 2] = imageData0.data[i + 2];
                            }
                            processedCtx.putImageData(finalData, 0, 0);
                
                            imagesData[0] = {
                                filename: file.name ?? 'image',
                                data: processedCanvas.toDataURL(),
                            };
                            completeFileUpload();
                            alpgaDg?.close();

                        });

                        document.getElementById('done')!.addEventListener('click', (e) => {
                            event.preventDefault();
                            console.log(`done`);
                            imagesData[0] = {
                                filename: file.name ?? 'image',
                                data: processedCanvas.toDataURL(),
                            };
                            completeFileUpload();
                            alpgaDg?.close();
                        });

                        // const redDotData: string = "data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==";
                        // const resultString = processedCanvas.toDataURL();
                        // console.log(resultString);
                        // imagesData.push({
                        //     filename: file.name ?? 'image',
                        //     data: resultString,
                        // });
                    }
                    // completeFileUpload();
                };
                reader.readAsDataURL(file);
            }
        });
    };
}

export function fetchUploadedAssets(
    onSuccess?: (response: AxiosResponse<any>) => void,
    onFailure?: (response: AxiosError<any>) => void,
) {
    return (dispatch: Dispatch<UploadAssetActions | NotificationAction>) =>
        requestAxios_DEPRECATED
            .get(ROOT_URL)
            .then((response) => {
                if (response.data && response.data.uploads) {
                    response.data.uploads.forEach(setupLinksOnUpload);
                }
                dispatch({
                    type: UPLOAD_ACTION.FETCH_UPLOADED_ASSETS,
                    uploads: response.data.uploads,
                });
                if (onSuccess) {
                    onSuccess(response.data);
                }
            })
            .catch((errorResponse: AxiosError<any>) => {
                handleAxiosErrorResponse(errorResponse, dispatch);
                if (onFailure && errorResponse?.response?.data) {
                    onFailure(errorResponse.response.data);
                }
            });
}

export function fetchUploadedAssetsSharedWithTeam(
    teamIds: string[],
    onSuccess?: (response: AxiosResponse<any>) => void,
    onFailure?: (response: AxiosError<any>) => void,
) {
    return (dispatch: Dispatch<UploadAssetActions | NotificationAction>) =>
        requestAxios_DEPRECATED
            .post(`${ROOT_URL}/shared-with-teams`, { teamIds })
            .then((response) => {
                response.data.uploads.forEach(setupLinksOnUpload);
                dispatch({
                    type: UPLOAD_ACTION.FETCH_UPLOADED_ASSETS_SHARED_WITH_TEAM,
                    uploads: response.data.uploads,
                });
                if (onSuccess) {
                    onSuccess(response.data);
                }
            })
            .catch((errorResponse: AxiosError<any>) => {
                handleAxiosErrorResponse(errorResponse, dispatch);
                if (onFailure && errorResponse?.response?.data) {
                    onFailure(errorResponse.response.data);
                }
            });
}

export function shareUploadWithMyTeam(
    id: string,
    teamIds: string[],
    callback?: (response: AxiosResponse<any>) => void,
) {
    return (dispatch: Dispatch<UploadAssetActions | NotificationAction>) => {
        dispatch({
            type: UPLOAD_ACTION.NEW_TEAM_ASSET_IN_PROGRESS,
            data: [],
        });
        return requestAxios_DEPRECATED
            .post(`${ROOT_URL}/${id}/share-with-teams`, { teamIds })
            .then((response) => {
                setupLinksOnUpload(response.data);
                dispatch({
                    type: UPLOAD_ACTION.MARK_SHARED_UPLOAD,
                    data: response.data,
                });
                if (callback) {
                    callback(response);
                }
            })
            .catch((errorResponse: AxiosError<any>) => handleAxiosErrorResponse(errorResponse, dispatch));
    };
}

export function stopSharingUploadWithMyTeam(
    id: string,
    teamIds: string[],
    callback?: (response: AxiosResponse<any>) => void,
) {
    return (dispatch: Dispatch<UploadAssetActions | NotificationAction>) =>
        requestAxios_DEPRECATED
            .post(`${ROOT_URL}/${id}/stop-sharing-with-team`, {
                teamIds,
            })
            .then((response) => {
                setupLinksOnUpload(response.data);
                dispatch({
                    type: UPLOAD_ACTION.STOP_SHARING_UPLOADED_ASSET_WITH_MY_TEAM,
                    data: response.data,
                });
                if (callback) {
                    callback(response);
                }
            })
            .catch((errorResponse: AxiosError<any>) => handleAxiosErrorResponse(errorResponse, dispatch));
}

export function editNameOfUploadedAsset(
    id: string,
    newName: string,
    callback?: (response: AxiosResponse<any>) => void,
) {
    return (dispatch: Dispatch<UploadAssetActions | NotificationAction>) =>
        requestAxios_DEPRECATED
            .post(`${ROOT_URL}/${id}`, { newName })
            .then((response) => {
                setupLinksOnUpload(response.data);
                dispatch({
                    type: UPLOAD_ACTION.EDIT_NAME_UPLOADED_ASSET,
                    data: response.data,
                });
                if (callback) {
                    callback(response);
                }
            })
            .catch((errorResponse: AxiosError<any>) => handleAxiosErrorResponse(errorResponse, dispatch));
}

export function deleteUploadedAsset(id: string, callback?: (response: AxiosResponse<any>) => void) {
    return (dispatch: Dispatch<UploadAssetActions | NotificationAction>) =>
        requestAxios_DEPRECATED
            .delete(`${ROOT_URL}/${id}`)
            .then((response) => {
                dispatch({
                    type: UPLOAD_ACTION.MARK_DELETED_UPLOAD,
                    _id: response.data._id,
                });
                if (callback) {
                    callback(response);
                }
            })
            .catch((errorResponse: AxiosError<any>) => handleAxiosErrorResponse(errorResponse, dispatch));
}

export function cancelUploadingImages() {
    return {
        type: UPLOAD_ACTION.CANCEL_UPLOADING_IMAGES,
        data: null,
    };
}

function handleAxiosErrorResponse(errorResponse: AxiosError<any>, dispatch: Dispatch<NotificationAction>) {
    if (errorResponse?.response?.data && typeof errorResponse?.response?.data === 'string') {
        addNotification(errorResponse.response.data, 'danger')(dispatch);
    }
    throw errorResponse; // for sentry, will not crash for user
}

export function setupLinksOnUpload(upload: {
    _id: string;
    imageFilename: string;
    thumbnailFilename: string;
    image?: object;
}) {
    // to get s3 signed urls
    if (!upload.image) {
        upload.image = {
            url: `${API_URL_CONSTANTS.ROOT_URL_UPLOADS}/${upload._id}/${upload.imageFilename}`,
            secure_url: `${API_URL_CONSTANTS.ROOT_URL_UPLOADS}/${upload._id}/${upload.imageFilename}`,
            thumbnailUrl: `${API_URL_CONSTANTS.ROOT_URL_UPLOADS}/${upload._id}/${upload.thumbnailFilename}`,
        };
    }
}
