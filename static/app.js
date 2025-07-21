// 全局变量
let currentPath = '/';
let selectedFiles = new Map();
let webdavConnected = false;
let aria2Connected = false;

// DOM元素
const webdavForm = document.getElementById('webdav-form');
const aria2Form = document.getElementById('aria2-form');
const fileBrowser = document.getElementById('file-browser');
const downloadManager = document.getElementById('download-manager');
const fileList = document.getElementById('file-list');
const downloadList = document.getElementById('download-list');
const breadcrumb = document.getElementById('breadcrumb');
const selectAllCheckbox = document.getElementById('select-all');
const downloadSelectedBtn = document.getElementById('download-selected-btn');
const selectedCountSpan = document.getElementById('selected-count');
const refreshBtn = document.getElementById('refresh-btn');
const refreshDownloadsBtn = document.getElementById('refresh-downloads-btn');
const loading = document.getElementById('loading');
const toast = new bootstrap.Toast(document.getElementById('toast'));
const webdavStatus = document.getElementById('webdav-status');
const aria2Status = document.getElementById('aria2-status');
const navbarWebdavStatus = document.getElementById('navbar-webdav-status');
const navbarAria2Status = document.getElementById('navbar-aria2-status');

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    checkConnectionStatus();
});

function setupEventListeners() {
    // WebDAV连接表单
    webdavForm.addEventListener('submit', handleWebdavConnection);
    
    // Aria2连接表单
    aria2Form.addEventListener('submit', handleAria2Connection);
    
    // 全选复选框
    selectAllCheckbox.addEventListener('change', handleSelectAll);
    
    // 下载选中文件按钮
    downloadSelectedBtn.addEventListener('click', handleDownloadSelected);
    
    // 刷新按钮
    refreshBtn.addEventListener('click', () => loadFiles(currentPath));
    
    // 刷新下载列表按钮
    refreshDownloadsBtn.addEventListener('click', loadDownloads);
    
    // 视频筛选开关变化事件
    const videoFilterSwitch = document.getElementById('video-filter-switch');
    const sizeFilterGroup = document.getElementById('size-filter-group');
    const minFileSizeInput = document.getElementById('min-file-size');
    
    videoFilterSwitch.addEventListener('change', function() {
        // 当视频筛选开关状态改变时，更新文件大小输入框的可用性
        if (this.checked) {
            sizeFilterGroup.style.opacity = '1';
            minFileSizeInput.disabled = false;
        } else {
            sizeFilterGroup.style.opacity = '0.6';
            minFileSizeInput.disabled = true;
        }
    });
    
    // 初始化文件大小输入框状态
    if (!videoFilterSwitch.checked) {
        sizeFilterGroup.style.opacity = '0.6';
        minFileSizeInput.disabled = true;
    }
    
    // 文件大小输入框变化事件
    minFileSizeInput.addEventListener('change', function() {
        const value = parseInt(this.value);
        if (value < 1) {
            this.value = 1;
            showToast('最小文件大小不能小于1MB', 'warning');
        } else if (value > 10240) {
            this.value = 10240;
            showToast('最大文件大小不能超过10GB', 'warning');
        }
    });
}

async function handleWebdavConnection(e) {
    e.preventDefault();
    
    console.log('开始连接WebDAV...');
    
    const formData = new FormData();
    formData.append('webdav_url', document.getElementById('webdav-url').value);
    formData.append('username', document.getElementById('username').value);
    formData.append('password', document.getElementById('password').value);
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/connect/webdav', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        console.log('WebDAV连接结果:', result);
        
        if (result.success) {
            webdavConnected = true;
            updateWebdavStatus(true);
            showToast('WebDAV连接成功！', 'success');
            
            // 如果WebDAV连接成功，显示文件浏览器并加载文件
            if (webdavConnected) {
                fileBrowser.style.display = 'block';
                await loadFiles('/');
            }
        } else {
            webdavConnected = false;
            updateWebdavStatus(false);
            showToast(result.message, 'error');
        }
    } catch (error) {
        console.error('WebDAV连接错误:', error);
        webdavConnected = false;
        updateWebdavStatus(false);
        showToast('WebDAV连接失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function handleAria2Connection(e) {
    e.preventDefault();
    
    console.log('开始连接Aria2...');
    
    const formData = new FormData();
    formData.append('aria2_url', document.getElementById('aria2-url').value);
    formData.append('aria2_secret', document.getElementById('aria2-secret').value);
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/connect/aria2', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        console.log('Aria2连接结果:', result);
        
        if (result.success) {
            aria2Connected = true;
            updateAria2Status(true);
            showToast('Aria2连接成功！', 'success');
            
            // 如果Aria2连接成功，显示下载管理界面并加载下载列表
            if (aria2Connected) {
                downloadManager.style.display = 'block';
                await loadDownloads();
            }
        } else {
            aria2Connected = false;
            updateAria2Status(false);
            showToast(result.message, 'error');
        }
    } catch (error) {
        console.error('Aria2连接错误:', error);
        aria2Connected = false;
        updateAria2Status(false);
        showToast('Aria2连接失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function checkConnectionStatus() {
    try {
        const response = await fetch('/api/status');
        const status = await response.json();
        
        webdavConnected = status.webdav_connected;
        aria2Connected = status.aria2_connected;
        
        updateWebdavStatus(webdavConnected);
        updateAria2Status(aria2Connected);
        
        if (webdavConnected) {
            fileBrowser.style.display = 'block';
            await loadFiles('/');
        }
        
        if (aria2Connected) {
            downloadManager.style.display = 'block';
            await loadDownloads();
        }
    } catch (error) {
        console.error('检查连接状态失败:', error);
    }
}

async function loadFiles(path) {
    if (!webdavConnected) return;
    
    showLoading(true);
    currentPath = path;
    
    try {
        const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
        const result = await response.json();
        
        if (result.success) {
            displayFiles(result.files);
            updateBreadcrumb(path);
            clearSelection();
        } else {
            showToast(result.message, 'error');
        }
    } catch (error) {
        showToast('加载文件失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function displayFiles(files) {
    fileList.innerHTML = '';
    
    // 添加返回上级目录选项（如果不在根目录）
    if (currentPath !== '/') {
        const parentPath = getParentPath(currentPath);
        const row = createFileRow({
            name: '..',
            path: parentPath,
            is_directory: true,
            isParent: true
        });
        fileList.appendChild(row);
    }
    
    // 排序：目录在前，文件在后
    files.sort((a, b) => {
        if (a.is_directory && !b.is_directory) return -1;
        if (!a.is_directory && b.is_directory) return 1;
        return a.name.localeCompare(b.name);
    });
    
    // 添加文件和目录
    files.forEach(file => {
        const row = createFileRow(file);
        fileList.appendChild(row);
    });
}

function createFileRow(file) {
    const row = document.createElement('tr');
    row.className = 'file-row';
    
    const isParent = file.isParent;
    const isVideo = !file.is_directory && isVideoFile(file.name);
    const minSizeMB = getMinFileSizeMB();
    const minSizeBytes = minSizeMB * 1024 * 1024;
    const isLargeVideo = isVideo && file.size >= minSizeBytes;
    
    let icon;
    if (file.is_directory) {
        icon = '<i class="bi bi-folder-fill file-icon folder-icon"></i>';
    } else if (isVideo) {
        icon = '<i class="bi bi-play-circle-fill file-icon video-icon"></i>';
    } else {
        icon = '<i class="bi bi-file-earmark file-icon file-icon-default"></i>';
    }
    
    const size = file.is_directory ? '-' : formatFileSize(file.size || 0);
    
    // 为大视频文件添加特殊样式
    const videoClass = isLargeVideo ? 'large-video-file' : '';
    const videoIndicator = isLargeVideo ? '<span class="badge bg-success ms-1" title="符合筛选条件的视频文件">✓ 视频</span>' : '';
    
    row.innerHTML = `
        <td>
            ${!isParent ? `<input type="checkbox" class="form-check-input file-checkbox" data-path="${file.path}" data-name="${file.name}" data-is-directory="${file.is_directory}" data-size="${file.size || 0}">` : ''}
        </td>
        <td>
            <span class="file-name ${videoClass}" data-path="${file.path}" data-is-directory="${file.is_directory}">
                ${icon}${file.name}${videoIndicator}
            </span>
        </td>
        <td>
            <span class="badge ${file.is_directory ? 'bg-warning' : isVideo ? 'bg-info' : 'bg-secondary'}">
                ${file.is_directory ? '目录' : isVideo ? '视频' : '文件'}
            </span>
        </td>
        <td class="file-size">${size}</td>
        <td>
            ${!isParent ? 
                `<button class="btn btn-sm btn-outline-primary download-single-btn" data-path="${file.path}" data-name="${file.name}" data-is-directory="${file.is_directory}" data-size="${file.size || 0}">
                    <i class="bi bi-download"></i>
                </button>` : 
                ''
            }
        </td>
    `;
    
    // 添加事件监听器
    const fileName = row.querySelector('.file-name');
    if (fileName) {
        fileName.addEventListener('click', () => {
            if (file.is_directory) {
                loadFiles(file.path);
            }
        });
    }
    
    const checkbox = row.querySelector('.file-checkbox');
    if (checkbox) {
        checkbox.addEventListener('change', handleFileSelection);
    }
    
    const downloadBtn = row.querySelector('.download-single-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const path = downloadBtn.dataset.path;
            const name = downloadBtn.dataset.name;
            const isDirectory = downloadBtn.dataset.isDirectory === 'true';
            const size = parseInt(downloadBtn.dataset.size) || 0;
            downloadSingleFile(path, name, isDirectory, size);
        });
    }
    
    return row;
}

function handleFileSelection(e) {
    const checkbox = e.target;
    const path = checkbox.dataset.path;
    const name = checkbox.dataset.name;
    const isDirectory = checkbox.dataset.isDirectory === 'true';
    const size = parseInt(checkbox.dataset.size) || 0;
    
    if (checkbox.checked) {
        selectedFiles.set(path, {
            path: path,
            name: name,
            is_directory: isDirectory,
            size: size
        });
    } else {
        selectedFiles.delete(path);
    }
    
    updateSelectionUI();
}

function handleSelectAll(e) {
    const checkboxes = document.querySelectorAll('.file-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = e.target.checked;
        
        // 触发change事件
        const event = new Event('change');
        checkbox.dispatchEvent(event);
    });
}

function clearSelection() {
    selectedFiles.clear();
    selectAllCheckbox.checked = false;
    updateSelectionUI();
}

function updateSelectionUI() {
    const count = selectedFiles.size;
    selectedCountSpan.textContent = count;
    downloadSelectedBtn.disabled = count === 0;
    
    // 更新全选复选框状态
    const checkboxes = document.querySelectorAll('.file-checkbox');
    const checkedBoxes = document.querySelectorAll('.file-checkbox:checked');
    
    if (checkboxes.length === 0) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = false;
    } else if (checkedBoxes.length === checkboxes.length) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = true;
    } else if (checkedBoxes.length > 0) {
        selectAllCheckbox.indeterminate = true;
    } else {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = false;
    }
}

async function handleDownloadSelected() {
    if (selectedFiles.size === 0) return;
    
    if (!aria2Connected) {
        showToast('请先连接Aria2下载器', 'error');
        return;
    }
    
    let files = Array.from(selectedFiles.values());
    
    // 检查是否启用视频文件筛选
    const videoFilterSwitch = document.getElementById('video-filter-switch');
    const videoFilter = videoFilterSwitch && videoFilterSwitch.checked;
    
    if (videoFilter) {
        const filteredFiles = filterVideoFiles(files);
        
        const minSizeMB = getMinFileSizeMB();
        
        if (filteredFiles.length === 0) {
            showToast(`没有符合条件的视频文件（≥${minSizeMB}MB）`, 'warning');
            return;
        }
        
        const filteredCount = filteredFiles.length;
        const totalCount = selectedFiles.size;
        if (filteredCount < totalCount) {
            showToast(`已筛选出 ${filteredCount} 个符合条件的视频文件（共选中 ${totalCount} 个文件，≥${minSizeMB}MB）`, 'info');
        }
        
        files = filteredFiles;
    }
    
    showLoading(true);
    
    try {
        const requestData = {
            files: files,
            video_filter: videoFilter,
            min_file_size_mb: getMinFileSizeMB()
        };
        
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            const successCount = result.results.filter(r => r.success).length;
            const failCount = result.results.filter(r => !r.success).length;
            
            if (successCount > 0) {
                let message = `成功添加 ${successCount} 个下载任务`;
                if (failCount > 0) {
                    message += `，${failCount} 个失败`;
                }
                showToast(message, 'success');
                
                // 刷新下载列表
                if (aria2Connected) {
                    await loadDownloads();
                }
            }
            
            if (failCount > 0) {
                // 显示具体的错误信息
                const firstError = result.results.find(r => !r.success);
                if (firstError && firstError.message) {
                    showToast(`下载失败: ${firstError.message}`, 'error');
                } else {
                    showToast(`${failCount} 个文件下载失败`, 'error');
                }
            }
            
            // 显示详细结果
            console.log('下载结果:', result.results);
            
            clearSelection();
        } else {
            showToast('批量下载失败', 'error');
        }
    } catch (error) {
        showToast('批量下载失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function downloadSingleFile(filePath, name, isDirectory = false, size = 0) {
    if (!filePath) return;
    
    if (!aria2Connected) {
        showToast('请先连接Aria2下载器', 'error');
        return;
    }
    
    // 检查是否启用视频文件筛选
    const videoFilterSwitch = document.getElementById('video-filter-switch');
    const videoFilter = videoFilterSwitch && videoFilterSwitch.checked;
    
    const files = [{
        name: name,
        path: filePath,
        is_directory: isDirectory,
        size: size
    }];
    
    try {
        const requestData = {
            files: files,
            video_filter: videoFilter,
            min_file_size_mb: getMinFileSizeMB()
        };
        
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (result.success && result.results.length > 0) {
            const successCount = result.results.filter(r => r.success).length;
            const failCount = result.results.filter(r => !r.success).length;
            
            if (successCount > 0) {
                if (isDirectory) {
                    showToast(`已添加文件夹下载任务: ${name} (${successCount}个文件)`, 'success');
                } else {
                    showToast(`已添加下载任务: ${name}`, 'success');
                }
                
                // 刷新下载列表
                if (aria2Connected) {
                    await loadDownloads();
                }
            }
            
            if (failCount > 0) {
                const firstError = result.results.find(r => !r.success);
                showToast(`下载失败: ${firstError.message}`, 'error');
            }
        } else {
            showToast(`下载失败: 没有可下载的文件`, 'error');
        }
    } catch (error) {
        showToast('下载失败: ' + error.message, 'error');
    }
}

function updateBreadcrumb(path) {
    breadcrumb.innerHTML = '';
    
    const parts = path.split('/').filter(part => part);
    
    // 根目录
    const rootItem = document.createElement('li');
    rootItem.className = 'breadcrumb-item';
    rootItem.innerHTML = '<a href="#" data-path="/">根目录</a>';
    breadcrumb.appendChild(rootItem);
    
    // 路径部分
    let currentPath = '';
    parts.forEach((part, index) => {
        currentPath += '/' + part;
        
        const item = document.createElement('li');
        item.className = 'breadcrumb-item';
        
        if (index === parts.length - 1) {
            item.className += ' active';
            item.textContent = part;
        } else {
            item.innerHTML = `<a href="#" data-path="${currentPath}">${part}</a>`;
        }
        
        breadcrumb.appendChild(item);
    });
    
    // 添加点击事件
    breadcrumb.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const path = e.target.dataset.path;
            loadFiles(path);
        });
    });
}

function getParentPath(path) {
    const parts = path.split('/').filter(part => part);
    parts.pop();
    return parts.length === 0 ? '/' : '/' + parts.join('/');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showLoading(show) {
    loading.style.display = show ? 'block' : 'none';
}

function showToast(message, type = 'info') {
    const toastBody = document.getElementById('toast-body');
    toastBody.textContent = message;
    
    const toastElement = document.getElementById('toast');
    toastElement.className = `toast ${type === 'success' ? 'bg-success text-white' : type === 'error' ? 'bg-danger text-white' : ''}`;
    
    toast.show();
}

function updateWebdavStatus(connected) {
    const statusClass = connected ? 'badge bg-success' : 'badge bg-danger';
    const statusText = connected ? '已连接' : '未连接';
    
    webdavStatus.className = statusClass;
    webdavStatus.textContent = statusText;
    navbarWebdavStatus.className = statusClass;
    navbarWebdavStatus.textContent = statusText;
}

function updateAria2Status(connected) {
    const statusClass = connected ? 'badge bg-success' : 'badge bg-danger';
    const statusText = connected ? '已连接' : '未连接';
    
    aria2Status.className = statusClass;
    aria2Status.textContent = statusText;
    navbarAria2Status.className = statusClass;
    navbarAria2Status.textContent = statusText;
}

// 下载管理相关函数
async function loadDownloads() {
    if (!aria2Connected) {
        return;
    }
    
    try {
        const response = await fetch('/api/aria2/downloads');
        const result = await response.json();
        
        if (result.success) {
            displayDownloads(result.downloads);
        } else {
            showToast('获取下载列表失败: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('获取下载列表失败:', error);
        showToast('获取下载列表失败: ' + error.message, 'error');
    }
}

function displayDownloads(downloads) {
    // downloadList 本身就是 tbody 元素
    downloadList.innerHTML = '';
    
    if (downloads.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="text-center text-muted">暂无下载任务</td>';
        downloadList.appendChild(row);
        return;
    }
    
    downloads.forEach(download => {
        const row = document.createElement('tr');
        
        // 文件名 - 使用name字段，如果没有则从files中获取
        let fileName = download.name || '未知文件';
        if (!fileName || fileName === '未知文件') {
            fileName = getFileNameFromUrl(download.files?.[0]?.uris?.[0]?.uri || '未知文件');
        }
        
        // 状态
        const statusText = getStatusText(download.status);
        const statusClass = getStatusClass(download.status);
        
        // 进度
        const progress = download.totalLength > 0 ? 
            Math.round((download.completedLength / download.totalLength) * 100) : 0;
        
        // 速度
        const speed = formatSpeed(download.downloadSpeed);
        
        // 大小
        const size = formatFileSize(download.totalLength);
        
        row.innerHTML = `
            <td title="${fileName}">${truncateText(fileName, 30)}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="progress" style="height: 20px;">
                    <div class="progress-bar" role="progressbar" style="width: ${progress}%">${progress}%</div>
                </div>
            </td>
            <td>${speed}</td>
            <td>${size}</td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    ${download.status === 'active' ? 
                        `<button class="btn btn-warning btn-sm" onclick="pauseDownload('${download.gid}')">暂停</button>` :
                        download.status === 'paused' ?
                        `<button class="btn btn-success btn-sm" onclick="resumeDownload('${download.gid}')">继续</button>` :
                        ''
                    }
                    <button class="btn btn-danger btn-sm" onclick="removeDownload('${download.gid}')">删除</button>
                </div>
            </td>
        `;
        
        downloadList.appendChild(row);
    });
}

async function pauseDownload(gid) {
    try {
        const response = await fetch(`/api/aria2/pause/${gid}`, {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.success) {
            showToast('下载已暂停', 'success');
            await loadDownloads();
        } else {
            showToast('暂停下载失败: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('暂停下载失败: ' + error.message, 'error');
    }
}

async function resumeDownload(gid) {
    try {
        const response = await fetch(`/api/aria2/resume/${gid}`, {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.success) {
            showToast('下载已继续', 'success');
            await loadDownloads();
        } else {
            showToast('继续下载失败: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('继续下载失败: ' + error.message, 'error');
    }
}

async function removeDownload(gid) {
    if (!confirm('确定要删除这个下载任务吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/aria2/remove/${gid}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        
        if (result.success) {
            showToast('下载任务已删除', 'success');
            await loadDownloads();
        } else {
            showToast('删除下载任务失败: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('删除下载任务失败: ' + error.message, 'error');
    }
}

function getFileNameFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const fileName = pathname.split('/').pop();
        return decodeURIComponent(fileName || '未知文件');
    } catch {
        return '未知文件';
    }
}

function getStatusText(status) {
    const statusMap = {
        'active': '下载中',
        'waiting': '等待中',
        'paused': '已暂停',
        'error': '错误',
        'complete': '已完成',
        'removed': '已删除'
    };
    return statusMap[status] || status;
}

function getStatusClass(status) {
    const classMap = {
        'active': 'bg-primary',
        'waiting': 'bg-secondary',
        'paused': 'bg-warning',
        'error': 'bg-danger',
        'complete': 'bg-success',
        'removed': 'bg-dark'
    };
    return classMap[status] || 'bg-secondary';
}

function formatSpeed(bytesPerSecond) {
    if (bytesPerSecond === 0) return '0 B/s';
    
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// 视频文件筛选函数
function filterVideoFiles(files) {
    const videoExtensions = [
        '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v',
        '.3gp', '.3g2', '.asf', '.rm', '.rmvb', '.vob', '.ts', '.mts',
        '.m2ts', '.divx', '.xvid', '.ogv', '.f4v', '.mpg', '.mpeg',
        '.m1v', '.m2v', '.mpe', '.mpv', '.mp2', '.mpa', '.mpu', '.mpg2'
    ];
    
    // 获取用户配置的最小文件大小
    const minFileSizeInput = document.getElementById('min-file-size');
    const minSizeMB = parseInt(minFileSizeInput.value) || 300;
    const minSizeBytes = minSizeMB * 1024 * 1024; // 转换为字节
    
    return files.filter(file => {
        // 文件夹直接通过，让后端处理文件夹内的文件筛选
        if (file.is_directory) {
            return true;
        }
        
        // 检查文件扩展名
        const fileName = file.name.toLowerCase();
        const isVideo = videoExtensions.some(ext => fileName.endsWith(ext));
        
        if (!isVideo) {
            return false;
        }
        
        // 检查文件大小
        const fileSize = file.size || 0;
        if (fileSize < minSizeBytes) {
            return false;
        }
        
        return true;
    });
}

// 获取当前配置的最小文件大小（MB）
function getMinFileSizeMB() {
    const minFileSizeInput = document.getElementById('min-file-size');
    return parseInt(minFileSizeInput.value) || 300;
}

// 获取文件扩展名
function getFileExtension(fileName) {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) return '';
    return fileName.substring(lastDotIndex).toLowerCase();
}

// 检查是否为视频文件
function isVideoFile(fileName) {
    const videoExtensions = [
        '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v',
        '.3gp', '.3g2', '.asf', '.rm', '.rmvb', '.vob', '.ts', '.mts',
        '.m2ts', '.divx', '.xvid', '.ogv', '.f4v', '.mpg', '.mpeg',
        '.m1v', '.m2v', '.mpe', '.mpv', '.mp2', '.mpa', '.mpu', '.mpg2'
    ];
    
    const extension = getFileExtension(fileName);
    return videoExtensions.includes(extension);
}