// PureWatch - Phase 1: Transcript Analysis
// Detects and skips sponsor segments using YouTube transcripts

class PureWatch {
    constructor() {
        this.video = null;
        this.videoId = null;
        this.transcript = null;
        this.sponsorSegments = [];
        this.isSkipping = false;
        this.checkInterval = null;
        
        // Sponsor detection patterns
        this.sponsorKeywords = [
            'sponsor', 'sponsored', 'brought to you by', 'thanks to',
            'promo code', 'discount code', 'coupon code', 'use code',
            'affiliate link', 'check out', 'special offer', 'get % off',
            'visit', 'sign up', 'download', 'try it out', 'free trial',
            'partnership', 'partnered with', 'working with',
            'shoutout to', 'big thanks to', 'this episode is brought',
            'today\'s sponsor', 'word from our sponsor', 'quick word from',
            'message from our sponsor', 'supported by', 'made possible by',
            'first box', 'new customers', 'limited time', 'exclusive offer',
            'head to', 'go to', 'for more information', 'to learn more',
            'free shipping', 'money back guarantee', 'satisfaction guaranteed',
            'new customers only', 'new clients only', 'new users only',
            'first time customers', 'offer expires', 'while supplies last',
            'terms and conditions apply', 'see website for details'
        ];
        
        this.init();
    }
    
    init() {
        console.log('PureWatch: Initializing...');
        this.waitForVideo();
    }
    
    waitForVideo() {
        // Wait for YouTube video player to load
        const checkVideo = setInterval(() => {
            this.video = document.querySelector('video');
            if (this.video) {
                clearInterval(checkVideo);
                console.log('PureWatch: Video element found');
                this.setupVideoListener();
            }
        }, 1000);
    }
    
    setupVideoListener() {
        // Monitor for video changes (new video loads)
        const observer = new MutationObserver(() => {
            const newVideoId = this.extractVideoId();
            if (newVideoId && newVideoId !== this.videoId) {
                this.videoId = newVideoId;
                console.log('PureWatch: New video detected:', this.videoId);
                this.analyzeVideo();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Check current video
        const currentVideoId = this.extractVideoId();
        if (currentVideoId) {
            this.videoId = currentVideoId;
            this.analyzeVideo();
        }
    }
    
    extractVideoId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('v');
    }
    
    async analyzeVideo() {
        console.log('PureWatch: Analyzing video...', this.videoId);
        
        // Method 1: Check for chapter markers first (most reliable)
        const chapterSponsors = this.detectChapterSponsors();
        if (chapterSponsors.length > 0) {
            console.log('PureWatch: ✅ Found', chapterSponsors.length, 'sponsor segments from chapters');
            this.sponsorSegments = chapterSponsors;
            this.startMonitoring();
            return;
        }
        
        // Method 2: Fetch transcript
        this.transcript = await this.fetchTranscript();
        
        if (!this.transcript || this.transcript.length === 0) {
            console.log('PureWatch: ❌ No transcript available');
            return;
        }
        
        console.log('PureWatch: ✅ Transcript loaded with', this.transcript.length, 'segments');
        
        // Log first few transcript lines for debugging
        console.log('PureWatch: First 5 transcript segments:');
        this.transcript.slice(0, 5).forEach((seg, i) => {
            console.log(`  [${i}] ${seg.start.toFixed(1)}s: "${seg.text}"`);
        });
        
        // Log a sample around 19-21 minutes (Joe Rogan sponsor time) 
        const sponsorTimeSample = this.transcript.filter(seg => seg.start >= 1175 && seg.start <= 1260);
        if (sponsorTimeSample.length > 0) {
            console.log('PureWatch: Transcript around 19:35-21:00 (checking for sponsor):');
            sponsorTimeSample.slice(0, 20).forEach(seg => {
                const text = seg.text.toLowerCase();
                const matches = this.sponsorKeywords.filter(kw => text.includes(kw.toLowerCase()));
                const matchStr = matches.length > 0 ? ` [MATCHES: ${matches.join(', ')}]` : '';
                console.log(`  ${Math.floor(seg.start/60)}:${(seg.start%60).toFixed(0).padStart(2, '0')} - "${seg.text}"${matchStr}`);
            });
        }
        
        // Detect sponsor segments
        this.sponsorSegments = this.detectSponsorSegments();
        
        if (this.sponsorSegments.length > 0) {
            console.log('PureWatch: ✅ Found', this.sponsorSegments.length, 'potential sponsor segments:');
            this.sponsorSegments.forEach((seg, i) => {
                const startTime = `${Math.floor(seg.start/60)}:${(seg.start%60).toFixed(0).padStart(2, '0')}`;
                const endTime = `${Math.floor(seg.end/60)}:${(seg.end%60).toFixed(0).padStart(2, '0')}`;
                const duration = (seg.end - seg.start).toFixed(1);
                console.log(`  [${i}] ${startTime} - ${endTime} (${duration}s, confidence: ${seg.confidence.toFixed(1)})`);
            });
            this.startMonitoring();
        } else {
            console.log('PureWatch: ❌ No sponsor segments detected');
            console.log('PureWatch: Checking for keyword matches in transcript...');
            
            // Debug: Check if ANY keywords match
            let keywordMatches = 0;
            this.transcript.forEach(line => {
                const text = line.text.toLowerCase();
                const matches = this.sponsorKeywords.filter(kw => text.includes(kw.toLowerCase()));
                if (matches.length > 0) {
                    keywordMatches++;
                    console.log(`  ${Math.floor(line.start/60)}:${(line.start%60).toFixed(0).padStart(2, '0')} - "${line.text}" [matched: ${matches.join(', ')}]`);
                }
            });
            console.log(`PureWatch: Total keyword matches: ${keywordMatches}`);
        }
    }
    
    detectChapterSponsors() {
        try {
            console.log('PureWatch: Checking for chapter markers...');
            
            // Look for chapter panel
            const chapterElements = document.querySelectorAll('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-macro-markers-description-chapters"]');
            
            if (chapterElements.length === 0) {
                console.log('PureWatch: No chapter panel found');
                return [];
            }
            
            console.log('PureWatch: ✅ Found chapter panel');
            
            // Get all chapter items
            const chapters = document.querySelectorAll('ytd-macro-markers-list-item-renderer');
            
            if (chapters.length === 0) {
                console.log('PureWatch: No chapters in panel');
                return [];
            }
            
            console.log('PureWatch: Found', chapters.length, 'chapters');
            
            const sponsorSegments = [];
            const sponsorKeywords = ['sponsor', 'ad', 'advertisement', 'promo', 'promotion'];
            
            chapters.forEach((chapter, index) => {
                const titleElement = chapter.querySelector('#details h4, #title');
                const timeElement = chapter.querySelector('#time');
                
                if (!titleElement || !timeElement) return;
                
                const title = titleElement.textContent.trim().toLowerCase();
                const timeText = timeElement.textContent.trim();
                
                console.log(`  Chapter ${index}: "${title}" at ${timeText}`);
                
                // Check if chapter title indicates sponsor
                const isSponsor = sponsorKeywords.some(kw => title.includes(kw));
                
                if (isSponsor) {
                    // Parse timestamp
                    const timeParts = timeText.split(':').map(Number).reverse();
                    const start = timeParts[0] + (timeParts[1] || 0) * 60 + (timeParts[2] || 0) * 3600;
                    
                    // End time is the start of the next chapter, or 60 seconds later if last
                    let end = start + 60;
                    if (index < chapters.length - 1) {
                        const nextChapter = chapters[index + 1];
                        const nextTimeElement = nextChapter.querySelector('#time');
                        if (nextTimeElement) {
                            const nextTimeText = nextTimeElement.textContent.trim();
                            const nextTimeParts = nextTimeText.split(':').map(Number).reverse();
                            end = nextTimeParts[0] + (nextTimeParts[1] || 0) * 60 + (nextTimeParts[2] || 0) * 3600;
                        }
                    }
                    
                    sponsorSegments.push({
                        start: start,
                        end: end,
                        confidence: 10,
                        keywordCount: 1,
                        source: 'chapter'
                    });
                    
                    console.log(`    ✅ Detected sponsor: ${start}s - ${end}s`);
                }
            });
            
            return sponsorSegments;
            
        } catch (error) {
            console.error('PureWatch: Error detecting chapter sponsors:', error);
            return [];
        }
    }
    
    async fetchTranscript() {
        console.log('PureWatch: Attempting to fetch transcript for video:', this.videoId);
        
        // Primary method: Parse from YouTube's page data
        return await this.fetchTranscriptFromPage();
    }
    
    async fetchTranscriptFromPage() {
        try {
            console.log('PureWatch: Fetching transcript from page data...');
            
            // Try to find ytInitialPlayerResponse with multiple attempts
            let ytInitialData = null;
            let attempts = 0;
            const maxAttempts = 10;
            
            while (!ytInitialData && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Try multiple possible locations
                ytInitialData = window.ytInitialPlayerResponse || 
                               window.ytplayer?.config?.args?.player_response ||
                               this.findPlayerResponseInPage();
                
                attempts++;
                if (!ytInitialData) {
                    console.log(`PureWatch: Attempt ${attempts}/${maxAttempts} - waiting for player data...`);
                }
            }
            
            if (!ytInitialData) {
                console.log('PureWatch: ❌ No ytInitialPlayerResponse found after', maxAttempts, 'attempts');
                return await this.fetchTranscriptFromDOM();
            }
            
            console.log('PureWatch: ✅ ytInitialPlayerResponse found');
            
            if (!ytInitialData.captions) {
                console.log('PureWatch: ❌ No captions in player response');
                return await this.fetchTranscriptFromDOM();
            }
            
            const captionTracks = ytInitialData.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            
            if (!captionTracks || captionTracks.length === 0) {
                console.log('PureWatch: ❌ No caption tracks found');
                return await this.fetchTranscriptFromDOM();
            }
            
            console.log('PureWatch: Found', captionTracks.length, 'caption tracks:', 
                captionTracks.map(t => `${t.languageCode} (${t.kind || 'manual'})`));
            
            // Prefer auto-generated English captions
            let captionTrack = captionTracks.find(track => 
                (track.languageCode === 'en' || track.languageCode.startsWith('en')) && 
                track.kind === 'asr'
            );
            
            // Fallback to any English captions
            if (!captionTrack) {
                captionTrack = captionTracks.find(track => 
                    track.languageCode === 'en' || track.languageCode.startsWith('en')
                );
            }
            
            if (!captionTrack) {
                console.log('PureWatch: ❌ No English caption track found');
                return await this.fetchTranscriptFromDOM();
            }
            
            console.log('PureWatch: Using caption track:', captionTrack.name?.simpleText || captionTrack.languageCode);
            
            const captionUrl = captionTrack.baseUrl + '&fmt=json3';
            console.log('PureWatch: Fetching captions from:', captionUrl);
            
            const response = await fetch(captionUrl);
            
            if (!response.ok) {
                console.log('PureWatch: ❌ Caption fetch failed with status:', response.status);
                return await this.fetchTranscriptFromDOM();
            }
            
            const text = await response.text();
            
            if (!text || text.trim() === '') {
                console.log('PureWatch: ❌ Empty caption response');
                return await this.fetchTranscriptFromDOM();
            }
            
            const data = JSON.parse(text);
            
            if (!data.events) {
                console.log('PureWatch: ❌ No events in caption data');
                return await this.fetchTranscriptFromDOM();
            }
            
            const transcript = data.events
                .filter(event => event.segs && event.tStartMs !== undefined)
                .map(event => ({
                    start: event.tStartMs / 1000,
                    duration: (event.dDurationMs || 2000) / 1000,
                    text: event.segs.map(seg => seg.utf8 || '').join('').trim()
                }))
                .filter(seg => seg.text.length > 0);
            
            console.log('PureWatch: ✅ Successfully parsed', transcript.length, 'transcript segments from API');
            return transcript;
                
        } catch (error) {
            console.error('PureWatch: ❌ Error fetching transcript from page:', error);
            return await this.fetchTranscriptFromDOM();
        }
    }
    
    findPlayerResponseInPage() {
        // Try to parse from page scripts
        try {
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                const content = script.textContent;
                if (content.includes('ytInitialPlayerResponse')) {
                    // Try to extract the JSON object
                    const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s);
                    if (match) {
                        return JSON.parse(match[1]);
                    }
                }
            }
        } catch (e) {
            console.log('PureWatch: Error parsing player response from scripts:', e);
        }
        return null;
    }
    
    async fetchTranscriptFromDOM() {
        try {
            console.log('PureWatch: Trying to fetch transcript from DOM...');
            
            // First, try to open the transcript if it's not already open
            let transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer');
            
            if (transcriptSegments.length === 0) {
                console.log('PureWatch: Transcript not visible, trying to click "Show transcript" button...');
                
                // Try to find and click the transcript button
                const transcriptButtons = [
                    document.querySelector('button[aria-label*="transcript" i]'),
                    document.querySelector('button[aria-label*="Show transcript" i]'),
                    ...Array.from(document.querySelectorAll('button')).filter(btn => 
                        btn.textContent.toLowerCase().includes('transcript')
                    )
                ];
                
                for (const btn of transcriptButtons) {
                    if (btn) {
                        console.log('PureWatch: Found transcript button, clicking...');
                        btn.click();
                        
                        // Wait for transcript to load
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer');
                        if (transcriptSegments.length > 0) {
                            console.log('PureWatch: ✅ Transcript opened successfully');
                            break;
                        }
                    }
                }
            }
            
            if (transcriptSegments.length === 0) {
                console.log('PureWatch: ❌ No transcript segments in DOM.');
                return [];
            }
            
            console.log('PureWatch: Found', transcriptSegments.length, 'transcript segments in DOM');
            
            const transcript = Array.from(transcriptSegments).map(segment => {
                const timeElement = segment.querySelector('.segment-timestamp');
                const textElement = segment.querySelector('.segment-text');
                
                if (!timeElement || !textElement) return null;
                
                const timeText = timeElement.textContent.trim();
                const text = textElement.textContent.trim();
                
                // Parse time (format: "0:00" or "1:23:45")
                const timeParts = timeText.split(':').map(Number).reverse();
                const seconds = timeParts[0] + (timeParts[1] || 0) * 60 + (timeParts[2] || 0) * 3600;
                
                return {
                    start: seconds,
                    duration: 2, // Approximate
                    text: text
                };
            }).filter(seg => seg !== null);
            
            console.log('PureWatch: ✅ Successfully parsed', transcript.length, 'segments from DOM');
            return transcript;
            
        } catch (error) {
            console.error('PureWatch: ❌ Error fetching transcript from DOM:', error);
            return [];
        }
    }
    
    detectSponsorSegments() {
        const segments = [];
        let currentSegment = null;
        let lastKeywordTime = null;
        let contextScore = 0; // Track cumulative sponsor-like context
        
        this.transcript.forEach((line, index) => {
            const text = line.text.toLowerCase();
            
            // Check if line contains sponsor keywords
            const hasSponsorKeyword = this.sponsorKeywords.some(keyword => 
                text.includes(keyword.toLowerCase())
            );
            
            // Additional sponsor indicators
            const hasCallToAction = /visit|head to|go to|check out|sign up|download|get \d+%|use code|click|link in description/i.test(text);
            const hasBrandMention = /\.com|offer|deal|discount|free shipping|first box|new customers|promo|coupon/i.test(text);
            
            // Product pitch patterns (common in sponsor reads)
            const hasProductPitch = /\b(real|fresh|quality|premium|best|perfect|amazing|incredible|fantastic|great)\s+(food|ingredients|product|service|solution|experience|recipe|tool)/i.test(text);
            const hasBenefitLanguage = /helps?|makes?|provides?|ensures?|guarantees?|designed to|created to|built to|made to|developed by|portioned for|packed for/i.test(text);
            const hasSalesLanguage = /customers?|users?|members?|subscribers?|you can|you will|you'll get|limited time|exclusive|always use|backed by/i.test(text);
            
            // Long descriptive sentences are often part of sponsor reads
            const isLongDescription = text.length > 100 && (hasProductPitch || hasBenefitLanguage || hasSalesLanguage);
            
            // Check for possessive brand language ("their X", "its X") which is common in sponsor descriptions
            const hasBrandPossessive = /\b(their|its)\s+(recipe|food|product|service|approach|method|system|formula|ingredients)/i.test(text);
            
            // Sponsor segments often have multiple product-related words
            const productWordCount = (text.match(/food|dogs?|ingredients|recipe|product|service|quality|fresh|customers?|nutritionists?|standards?|formula/gi) || []).length;
            const hasMultipleProductWords = productWordCount >= 4 && text.length > 80; // Need 4+ words AND longer text
            
            const isSponsorContent = hasSponsorKeyword || 
                                    (hasMultipleProductWords && (hasProductPitch || hasBenefitLanguage)) ||
                                    (currentSegment && (hasCallToAction || hasBrandMention || isLongDescription || hasBenefitLanguage || hasBrandPossessive || hasSalesLanguage));
            
            // Update context score
            if (isSponsorContent) {
                contextScore += (hasSponsorKeyword ? 3 : 1);
            } else {
                contextScore = Math.max(0, contextScore - 0.5);
            }
            
            if (isSponsorContent || (currentSegment && contextScore > 2)) {
                if (!currentSegment) {
                    // Start new segment (include 1 second before for context)
                    currentSegment = {
                        start: Math.max(0, line.start - 1),
                        end: line.start + line.duration,
                        confidence: hasSponsorKeyword ? 3 : 1,
                        keywordCount: hasSponsorKeyword ? 1 : 0
                    };
                    lastKeywordTime = line.start;
                } else {
                    // Extend current segment
                    currentSegment.end = line.start + line.duration;
                    if (hasSponsorKeyword || hasCallToAction || hasBrandMention) {
                        currentSegment.confidence += 2;
                        if (hasSponsorKeyword) currentSegment.keywordCount++;
                        lastKeywordTime = line.start;
                    } else if (hasMultipleProductWords || hasBrandPossessive) {
                        currentSegment.confidence += 1;
                    } else {
                        currentSegment.confidence += 0.3;
                    }
                }
            } else if (currentSegment) {
                // Check if we should close the segment
                // Close if more than 12 seconds of non-sponsor content
                const timeSinceLastKeyword = line.start - lastKeywordTime;
                const gapFromSegment = line.start - currentSegment.end;
                
                if (gapFromSegment > 12 || (timeSinceLastKeyword > 25 && gapFromSegment > 6 && contextScore < 2)) {
                    // Add 1 second buffer at the end
                    currentSegment.end += 1;
                    segments.push(currentSegment);
                    currentSegment = null;
                    lastKeywordTime = null;
                    contextScore = 0;
                }
            }
        });
        
        // Close any remaining segment
        if (currentSegment) {
            currentSegment.end += 1;
            segments.push(currentSegment);
        }
        
        // Remove duplicates and filter by confidence
        const uniqueSegments = this.removeDuplicateSegments(segments);
        
        // Merge segments that are close together (likely same sponsor)
        const mergedSegments = this.mergeCloseSegments(uniqueSegments);
        
        // Filter segments by minimum duration and confidence
        const filtered = mergedSegments.filter(seg => {
            const duration = seg.end - seg.start;
            const meetsMinDuration = duration >= 10;
            const meetsMaxDuration = duration <= 120;
            const meetsConfidence = seg.confidence >= 4;
            const hasKeywords = seg.keywordCount >= 1;
            
            const passes = meetsMinDuration && meetsMaxDuration && meetsConfidence && hasKeywords;
            
            // Debug log for segments around 19:38
            if (seg.start >= 1170 && seg.start <= 1190) {
                console.log(`PureWatch: Segment at ${Math.floor(seg.start/60)}:${(seg.start%60).toFixed(0).padStart(2, '0')} - Filter check:`, {
                    duration: duration.toFixed(1),
                    confidence: seg.confidence.toFixed(1),
                    keywordCount: seg.keywordCount,
                    meetsMinDuration,
                    meetsMaxDuration,
                    meetsConfidence,
                    hasKeywords,
                    passes
                });
            }
            
            return passes;
        });
        
        return filtered;
    }
    
    mergeCloseSegments(segments) {
        if (segments.length === 0) return segments;
        
        // Sort by start time
        const sorted = [...segments].sort((a, b) => a.start - b.start);
        const merged = [sorted[0]];
        
        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            const previous = merged[merged.length - 1];
            
            // If segments are within 15 seconds of each other, merge them
            if (current.start - previous.end <= 15) {
                previous.end = Math.max(previous.end, current.end);
                previous.confidence += current.confidence;
                previous.keywordCount += current.keywordCount;
            } else {
                merged.push(current);
            }
        }
        
        return merged;
    }
    
    removeDuplicateSegments(segments) {
        // Remove segments that overlap significantly
        const unique = [];
        
        for (const seg of segments) {
            const isDuplicate = unique.some(existing => {
                const overlapStart = Math.max(seg.start, existing.start);
                const overlapEnd = Math.min(seg.end, existing.end);
                const overlap = Math.max(0, overlapEnd - overlapStart);
                const minDuration = Math.min(seg.end - seg.start, existing.end - existing.start);
                
                // If 80% or more overlap, consider it a duplicate
                return (overlap / minDuration) > 0.8;
            });
            
            if (!isDuplicate) {
                unique.push(seg);
            }
        }
        
        return unique;
    }
    
    startMonitoring() {
        // Clear any existing interval
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        
        console.log('PureWatch: Starting playback monitoring...');
        
        // Check every 500ms if we need to skip
        this.checkInterval = setInterval(() => {
            if (!this.video || this.video.paused) return;
            
            const currentTime = this.video.currentTime;
            
            for (const segment of this.sponsorSegments) {
                if (currentTime >= segment.start && currentTime < segment.end) {
                    if (!this.isSkipping) {
                        this.skipSegment(segment);
                    }
                    break;
                }
            }
        }, 500);
        
        // Also log when video plays through the sponsor time
        this.video.addEventListener('timeupdate', () => {
            const currentTime = this.video.currentTime;
            // Check if we're near the 19:38 mark
            if (Math.abs(currentTime - 1178) < 2 && !this.isSkipping) {
                console.log(`PureWatch: Currently at ${currentTime.toFixed(1)}s (19:38 area) - checking segments...`);
                console.log('PureWatch: Active segments:', this.sponsorSegments.map(s => `${s.start.toFixed(0)}-${s.end.toFixed(0)}`));
            }
        }, { once: false });
    }
    
    skipSegment(segment) {
        this.isSkipping = true;
        console.log(`PureWatch: Skipping sponsor from ${segment.start}s to ${segment.end}s`);
        
        // Skip to end of segment
        this.video.currentTime = segment.end;
        
        // Show notification
        this.showNotification(segment);
        
        // Reset skip flag after 2 seconds
        setTimeout(() => {
            this.isSkipping = false;
        }, 2000);
    }
    
    showNotification(segment) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'purewatch-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                bottom: 80px;
                right: 20px;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                z-index: 9999;
                animation: slideIn 0.3s ease;
            ">
                ⚡ PureWatch: Skipped ${Math.round(segment.end - segment.start)}s sponsor
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize PureWatch
const pureWatch = new PureWatch();