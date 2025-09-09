// Project showcase functionality
console.log('Loading updated script.js with notes detection...');
class ProjectShowcase {
    constructor() {
        this.projects = [];
        this.categories = new Set(['all']);
        this.currentFilter = 'all';
        this.currentView = 'weekly'; // 'weekly' or 'streak'
        this.githubUsername = 'vibespin'; // Replace with your GitHub username
        this.githubToken = null; // Add your GitHub personal access token here if repos are private
        this.init();
    }

    async init() {
        await this.loadProjects();
        this.setupCategories();
        this.renderProjects();
        this.setupEventListeners();
    }

    async loadProjects() {
        try {
            // Fetch live data from GitHub API
            const headers = {};
            if (this.githubToken) {
                headers['Authorization'] = `token ${this.githubToken}`;
            }
            
            const response = await fetch(`https://api.github.com/users/${this.githubUsername}/repos?sort=updated&per_page=100`, {
                headers: headers
            });
            const repos = await response.json();
            
            // Filter for date-prefixed repositories (YYYY-MM-DD pattern)
            console.log('All repos:', repos.map(r => r.name)); // Debug log
            const dateFilteredRepos = repos
                .filter(repo => repo.name.match(/^\d{4}-\d{2}-\d{2}/))
                .sort((a, b) => b.name.localeCompare(a.name));
            
            // Fetch detailed repo info including topics for each repo
            console.log('About to fetch detailed info for repos:', dateFilteredRepos.map(r => r.name));
            this.projects = await Promise.all(
                dateFilteredRepos.map(async (repo) => {
                    try {
                        console.log('Fetching detailed info for:', repo.full_name);
                        // Fetch detailed repo info to get topics
                        const detailResponse = await fetch(`https://api.github.com/repos/${repo.full_name}`, {
                            headers: headers
                        });
                        console.log('Detail response status for', repo.name, ':', detailResponse.status);
                        if (detailResponse.ok) {
                            const detailedRepo = await detailResponse.json();
                            console.log('Got detailed repo data for', repo.name, 'topics:', detailedRepo.topics);
                            return this.convertGitHubRepo(detailedRepo);
                        } else {
                            console.warn('Detail fetch failed for', repo.name, 'using basic info');
                            // Fallback to basic repo info if detailed fetch fails
                            return this.convertGitHubRepo(repo);
                        }
                    } catch (error) {
                        console.warn('Failed to fetch details for repo:', repo.name, error);
                        return this.convertGitHubRepo(repo);
                    }
                })
            );
            
            console.log('Filtered date-prefixed projects:', this.projects); // Debug log
            
            // Extract unique categories
            this.projects.forEach(project => {
                this.categories.add(project.category);
            });
        } catch (error) {
            console.error('Failed to load projects from GitHub:', error);
            // Show error message to user
            document.getElementById('projects-grid').innerHTML = `
                <div class="col-span-full text-center py-12">
                    <div class="text-gray-500 mb-4">
                        <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <p class="text-lg font-medium">unable to load projects from github</p>
                        <p class="text-sm mt-2">check the console for more details</p>
                    </div>
                </div>
            `;
            
            // Fallback to static data
            try {
                const response = await fetch('projects.json');
                this.projects = await response.json();
                console.log('Loaded fallback projects:', this.projects);
                this.projects.forEach(project => {
                    this.categories.add(project.category);
                });
            } catch (fallbackError) {
                console.error('Failed to load fallback projects:', fallbackError);
                this.projects = [];
            }
        }
    }

    convertGitHubRepo(repo) {
        // Extract category from repo name and convert to readable format
        const nameWithoutPrefix = repo.name.replace(/^\d{4}-\d{2}-\d{2}-/, '');
        const title = this.formatTitle(repo.name);
        
        // Check if this is a note first (based on topics or title)
        const isNote = (repo.topics && repo.topics.includes('notes')) || title.toLowerCase().includes('daily notes');
        const category = isNote ? 'Notes' : this.extractCategory(repo.name);
        
        console.log('Converting repo:', repo.name, 'Topics from API:', repo.topics, 'Is Note:', isNote, 'Category:', category);
        
        return {
            id: repo.id,
            title: title,
            tagline: repo.description || 'No description available',
            category: category,
            githubUrl: repo.html_url,
            image: `https://opengraph.githubassets.com/1/${repo.full_name}`,
            updated_at: repo.updated_at,
            language: repo.language,
            stars: repo.stargazers_count,
            topics: repo.topics || []
        };
    }

    extractCategory(repoName) {
        // Map exact repo names to categories
        const categoryMap = {
            '2025-09-02-support-ab-testing': 'Analytics & Testing',
            '2025-08-28-payments-flow': 'E-commerce', 
            '2025-08-29-isometric-imgen': 'AI Generative Media',
            '2025-08-26-user-analytics-v2': 'User Research',
            '2025-08-27-user-analytics': 'User Research',
            '2025-08-25-landing-onboarding-flow': 'User Experience'
        };

        // Check for exact matches first
        if (categoryMap[repoName]) {
            return categoryMap[repoName];
        }

        // Fallback categorization based on common terms
        if (repoName.includes('support') || repoName.includes('ab_testing') || repoName.includes('analytics')) return 'Analytics & Testing';
        if (repoName.includes('payment') || repoName.includes('commerce')) return 'E-commerce';
        if (repoName.includes('user') || repoName.includes('feedback')) return 'User Research';
        if (repoName.includes('ai') || repoName.includes('image') || repoName.includes('gen') || repoName.includes('isometric')) return 'AI Generative Media';
        if (repoName.includes('landing') || repoName.includes('onboarding')) return 'User Experience';
        
        return 'Development';
    }

    formatTitle(repoName) {
        // Clean up repo name for display
        let title = repoName
            .replace(/^\d{4}-\d{2}-\d{2}-/, '') // Remove date prefix
            .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
            .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize first letter of each word
            
        // Handle specific cases
        title = title
            .replace(/Ab Testing/g, 'A/B Testing')
            .replace(/Ai /g, 'AI ')
            .replace(/Api/g, 'API')
            .replace(/Ui/g, 'UI')
            .replace(/Ux/g, 'UX');
            
        return title;
    }

    async openReadmeModal(repo) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('readme-modal');
        if (!modal) {
            modal = this.createReadmeModal();
            document.body.appendChild(modal);
        }

        // Show modal with loading state
        modal.style.display = 'flex';
        const content = modal.querySelector('.readme-content');
        content.innerHTML = `
            <div class="flex items-center justify-center py-12">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span class="ml-3">loading content...</span>
            </div>
        `;

        try {
            let markdownContent = '';
            
            // Check if this is a note project by looking for the "notes" topic
            const isNote = await this.isNoteRepo(repo);
            
            if (isNote) {
                // For notes, fetch the main .md file
                markdownContent = await this.fetchNoteContent(repo);
            } else {
                // For projects, fetch the README as usual
                markdownContent = await this.fetchReadmeContent(repo);
            }
            
            // Simple markdown to HTML conversion
            const htmlContent = this.convertMarkdownToHTML(markdownContent);
            content.innerHTML = htmlContent;
            
        } catch (error) {
            const isNote = await this.isNoteRepo(repo);
            const contentType = isNote ? 'note' : 'readme';
            content.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-gray-500">${contentType} not available</p>
                    <p class="text-sm text-gray-400 mt-2">this repository may not have a ${contentType} file</p>
                </div>
            `;
        }
    }

    async isNoteRepo(repo) {
        try {
            // Get repository info to check topics
            const response = await fetch(`https://api.github.com/repos/${repo}`, {
                headers: this.githubToken ? { 'Authorization': `token ${this.githubToken}` } : {}
            });
            
            if (!response.ok) return false;
            
            const repoData = await response.json();
            return repoData.topics && repoData.topics.includes('notes');
            
        } catch (error) {
            return false;
        }
    }

    async fetchNoteContent(repo) {
        // Get repository contents
        const response = await fetch(`https://api.github.com/repos/${repo}/contents`, {
            headers: this.githubToken ? { 'Authorization': `token ${this.githubToken}` } : {}
        });
        
        if (!response.ok) {
            throw new Error('Could not fetch repository contents');
        }
        
        const files = await response.json();
        
        // Find the main .md file (prefer one with today's date in the name)
        const repoName = repo.split('/').pop();
        const dateMatch = repoName.match(/^(\d{4}-\d{2}-\d{2})/);
        
        let targetFile = files.find(file => 
            file.name.endsWith('.md') && 
            file.type === 'file' &&
            (dateMatch ? file.name.includes(dateMatch[1]) : true)
        );
        
        // If no date-specific file, get the first .md file
        if (!targetFile) {
            targetFile = files.find(file => file.name.endsWith('.md') && file.type === 'file');
        }
        
        if (!targetFile) {
            throw new Error('No markdown file found');
        }
        
        // Fetch the file content
        const fileResponse = await fetch(targetFile.download_url);
        if (!fileResponse.ok) {
            throw new Error('Could not fetch file content');
        }
        
        return await fileResponse.text();
    }

    async fetchReadmeContent(repo) {
        // Fetch README from GitHub API (original logic)
        const response = await fetch(`https://api.github.com/repos/${repo}/readme`, {
            headers: this.githubToken ? { 'Authorization': `token ${this.githubToken}` } : {}
        });
        
        if (!response.ok) {
            throw new Error('README not found');
        }

        const data = await response.json();
        // Properly decode base64 to UTF-8
        const base64Content = data.content.replace(/\s/g, ''); // Remove whitespace
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    }

    createReadmeModal() {
        const modal = document.createElement('div');
        modal.id = 'readme-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.style.display = 'none';
        
        modal.innerHTML = `
            <div class="bg-white rounded-xl max-w-4xl max-h-[90vh] w-full flex flex-col">
                <div class="flex items-center justify-between p-6 border-b">
                    <h2 class="text-xl font-semibold">readme</h2>
                    <button class="close-modal text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                <div class="readme-content flex-1 overflow-auto p-6 prose max-w-none"></div>
            </div>
        `;

        // Add close functionality
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        return modal;
    }

    convertMarkdownToHTML(markdown) {
        // Comprehensive markdown to HTML conversion matching GitHub's rendering
        const lines = markdown.split('\n');
        let html = '';
        let inCodeBlock = false;
        let codeBlockLanguage = '';
        let currentList = null; // 'ul' or 'ol' or null
        let listDepth = 0;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Handle code blocks first
            if (line.startsWith('```')) {
                if (!inCodeBlock) {
                    // Starting code block
                    inCodeBlock = true;
                    codeBlockLanguage = line.substring(3).trim();
                    html += `<pre class="bg-gray-900 text-gray-100 rounded-lg p-4 my-4 overflow-x-auto"><code class="language-${codeBlockLanguage}">`;
                } else {
                    // Ending code block
                    inCodeBlock = false;
                    html += '</code></pre>';
                }
                continue;
            }
            
            // Inside code block - just add the line
            if (inCodeBlock) {
                html += this.escapeHtml(line) + '\n';
                continue;
            }
            
            // Close any open lists if we hit a non-list line
            if (!this.isListItem(line) && currentList) {
                html += `</${currentList}>`;
                currentList = null;
                listDepth = 0;
            }
            
            // Empty lines
            if (line.trim() === '') {
                if (currentList) {
                    // Don't close lists on empty lines
                    continue;
                } else {
                    html += '<br>';
                    continue;
                }
            }
            
            // Headers with emoji support
            if (line.startsWith('# ')) {
                html += `<h1 class="text-3xl font-bold mt-8 mb-4">${this.processInlineFormatting(line.substring(2))}</h1>`;
            } else if (line.startsWith('## ')) {
                html += `<h2 class="text-2xl font-semibold mt-6 mb-3">${this.processInlineFormatting(line.substring(3))}</h2>`;
            } else if (line.startsWith('### ')) {
                html += `<h3 class="text-xl font-medium mt-4 mb-2">${this.processInlineFormatting(line.substring(4))}</h3>`;
            } else if (line.startsWith('#### ')) {
                html += `<h4 class="text-lg font-medium mt-3 mb-2">${this.processInlineFormatting(line.substring(5))}</h4>`;
            }
            // Task lists (checkboxes)
            else if (line.match(/^[\s]*- \[[ x]\]/)) {
                const indent = (line.match(/^(\s*)/)[1].length / 2) * 20; // 20px per indent level
                const isChecked = line.includes('[x]') || line.includes('[X]');
                const taskText = line.replace(/^[\s]*- \[[ xX]\]\s*/, '');
                
                if (!currentList || currentList !== 'task-list') {
                    if (currentList) html += `</${currentList}>`;
                    html += '<ul class="task-list my-3">';
                    currentList = 'task-list';
                }
                
                html += `<li class="flex items-start" style="margin-left: ${indent}px;">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} disabled class="mt-1 mr-2 h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500">
                    <span class="${isChecked ? 'line-through text-gray-500' : ''}">${this.processInlineFormatting(taskText)}</span>
                </li>`;
            }
            // Regular unordered lists
            else if (line.match(/^[\s]*[-*+]\s/)) {
                const indent = (line.match(/^(\s*)/)[1].length / 2) * 20;
                const listText = line.replace(/^[\s]*[-*+]\s*/, '');
                
                if (!currentList || currentList !== 'ul') {
                    if (currentList) html += `</${currentList}>`;
                    html += '<ul class="list-disc ml-6 my-3">';
                    currentList = 'ul';
                }
                
                html += `<li style="margin-left: ${indent}px;">${this.processInlineFormatting(listText)}</li>`;
            }
            // Ordered lists
            else if (line.match(/^[\s]*\d+\.\s/)) {
                const indent = (line.match(/^(\s*)/)[1].length / 2) * 20;
                const listText = line.replace(/^[\s]*\d+\.\s*/, '');
                
                if (!currentList || currentList !== 'ol') {
                    if (currentList) html += `</${currentList}>`;
                    html += '<ol class="list-decimal ml-6 my-3">';
                    currentList = 'ol';
                }
                
                html += `<li style="margin-left: ${indent}px;">${this.processInlineFormatting(listText)}</li>`;
            }
            // Regular paragraphs
            else {
                const processedLine = this.processInlineFormatting(line);
                if (processedLine.trim()) {
                    html += `<p class="my-2 leading-relaxed">${processedLine}</p>`;
                }
            }
        }
        
        // Close any remaining open list
        if (currentList) {
            html += `</${currentList}>`;
        }
        
        return html;
    }
    
    isListItem(line) {
        return line.match(/^[\s]*[-*+]\s/) || 
               line.match(/^[\s]*\d+\.\s/) || 
               line.match(/^[\s]*- \[[ xX]\]/);
    }
    
    processInlineFormatting(text) {
        let result = text;
        
        // First handle code (to protect it from other formatting)
        const codeBlocks = [];
        result = result.replace(/`([^`]+)`/g, (match, code) => {
            codeBlocks.push(code);
            return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
        });
        
        // Handle links (to protect them from formatting)
        const links = [];
        result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
            links.push({ text, url });
            return `__LINK_${links.length - 1}__`;
        });
        
        // Bold text - handle both ** and __ (non-greedy)
        result = result.replace(/\*\*([^\*]+?)\*\*/g, '<strong>$1</strong>');
        result = result.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
        
        // Italic text - handle both * and _ (but not if adjacent to bold)
        result = result.replace(/(?<!\*|\w)\*([^\*\n]+?)\*(?!\*)/g, '<em>$1</em>');
        result = result.replace(/(?<!_|\w)_([^_\n]+?)_(?!_)/g, '<em>$1</em>');
        
        // Restore links
        result = result.replace(/__LINK_(\d+)__/g, (match, index) => {
            const link = links[parseInt(index)];
            return `<a href="${link.url}" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">${link.text}</a>`;
        });
        
        // Restore code blocks
        result = result.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
            const code = codeBlocks[parseInt(index)];
            return `<code class="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">${this.escapeHtml(code)}</code>`;
        });
        
        return result;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupCategories() {
        const filterButtons = document.getElementById('filter-buttons');
        
        // Clear existing buttons except "All Projects"
        const allButton = filterButtons.querySelector('[data-category="all"]');
        filterButtons.innerHTML = '';
        filterButtons.appendChild(allButton);

        // Add category buttons
        [...this.categories].filter(cat => cat !== 'all').sort().forEach(category => {
            const button = document.createElement('button');
            button.className = 'filter-button px-4 py-2 bg-gray-200 text-gray-700 rounded-full transition-all hover:bg-gray-300';
            button.textContent = category.toLowerCase();
            button.dataset.category = category;
            filterButtons.appendChild(button);
        });
    }

    extractDateFromProject(project) {
        // Extract date from GitHub URL since that's where the repo name with date prefix is
        const githubUrl = project.githubUrl;
        if (!githubUrl) return null;
        
        // Extract the repo name from the URL (last part after the final slash)
        const repoName = githubUrl.split('/').pop();
        if (!repoName) return null;
        
        // Look for YYYY-MM-DD pattern at the start of the repo name
        const match = repoName.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return null;
        
        const [_, year, month, day] = match;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    renderProjects() {
        const container = document.getElementById('calendar-container');
        const filteredProjects = this.currentFilter === 'all' 
            ? this.projects 
            : this.projects.filter(project => project.category === this.currentFilter);

        if (this.currentView === 'streak') {
            this.renderStreakView(container, filteredProjects);
        } else {
            this.renderWeeklyView(container, filteredProjects);
        }
    }
    
    renderWeeklyView(container, filteredProjects) {
        // Separate projects with valid dates from those without
        const { scheduledProjects, unscheduledProjects } = this.separateProjectsByDate(filteredProjects);

        // Group scheduled projects by week
        const weeklyGroups = this.groupProjectsByWeek(scheduledProjects);
        
        // Render calendar weeks
        let html = weeklyGroups.map(week => this.renderWeek(week)).join('');
        
        // Add misc section for unscheduled projects if any exist
        if (unscheduledProjects.length > 0) {
            html += this.renderMiscSection(unscheduledProjects);
        }
        
        container.innerHTML = html;
        container.className = 'space-y-4 ml-24';
        
        // Show weekly elements
        const calendarHeader = document.querySelector('.calendar-header-container');
        if (calendarHeader) {
            calendarHeader.style.display = 'block';
            calendarHeader.classList.remove('streak-mode');
        }
        
        // Highlight current day in header
        this.updateCurrentDayHeader();
        
        // Add event listeners
        this.addProjectEventListeners();
    }
    
    renderStreakView(container, filteredProjects) {
        // Hide weekly elements
        const calendarHeader = document.querySelector('.calendar-header-container');
        if (calendarHeader) {
            calendarHeader.style.display = 'none';
            calendarHeader.classList.add('streak-mode');
        }
        
        // Create year view with monthly breakdown
        const currentYear = new Date().getFullYear();
        const yearData = this.groupProjectsByYear(filteredProjects, currentYear);
        
        container.className = 'streak-view ml-24';
        container.innerHTML = this.renderStreakYear(yearData, currentYear);
        
        // Add streak event listeners
        this.addStreakEventListeners();
    }

    separateProjectsByDate(projects) {
        const scheduledProjects = [];
        const unscheduledProjects = [];
        
        projects.forEach(project => {
            const extractedDate = this.extractDateFromProject(project);
            if (extractedDate) {
                // Add the extracted date to the project for later use
                project.extractedDate = extractedDate;
                scheduledProjects.push(project);
            } else {
                unscheduledProjects.push(project);
            }
        });
        
        return { scheduledProjects, unscheduledProjects };
    }

    groupProjectsByWeek(projects) {
        const weeks = new Map();
        
        // Add current week if no projects exist for it
        const today = new Date();
        const currentWeekStart = this.getWeekStart(today);
        const currentWeekKey = this.formatWeekKey(currentWeekStart);
        weeks.set(currentWeekKey, {
            weekStart: currentWeekStart,
            projects: Array(7).fill(null).map(() => [])
        });
        
        // Group projects by week using extracted dates
        projects.forEach(project => {
            // Use the extracted date instead of updated_at
            const projectDate = project.extractedDate;
            const weekStart = this.getWeekStart(projectDate);
            const weekKey = this.formatWeekKey(weekStart);
            
            if (!weeks.has(weekKey)) {
                weeks.set(weekKey, {
                    weekStart: weekStart,
                    projects: Array(7).fill(null).map(() => [])
                });
            }
            
            const dayOfWeek = this.getDayOfWeek(projectDate);
            weeks.get(weekKey).projects[dayOfWeek].push(project);
        });
        
        // Convert to array and sort by week start (newest first)
        return Array.from(weeks.values())
            .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
    }
    
    groupProjectsByYear(projects, year) {
        const yearData = {
            months: {},
            totalProjects: 0,
            totalNotes: 0,
            activeMonths: 0,
            maxProjectsPerDay: 0
        };
        
        // Initialize months from August onwards (month 7 = August)
        const startMonth = 7; // August
        for (let month = startMonth; month < 12; month++) {
            yearData.months[month] = {};
        }
        
        // Process projects with valid dates
        const { scheduledProjects } = this.separateProjectsByDate(projects);
        
        scheduledProjects.forEach(project => {
            const date = project.extractedDate;
            if (date.getFullYear() === year) {
                const month = date.getMonth();
                const day = date.getDate();
                
                // Only include projects from August onwards
                if (month >= 7 && yearData.months[month] !== undefined) {
                    if (!yearData.months[month][day]) {
                        yearData.months[month][day] = [];
                    }
                    yearData.months[month][day].push(project);
                    
                    // Count projects and notes separately
                    if (this.isNoteProject(project)) {
                        yearData.totalNotes++;
                    } else {
                        yearData.totalProjects++;
                    }
                    
                    // Track max projects per day for intensity calculation
                    const dayCount = yearData.months[month][day].length;
                    if (dayCount > yearData.maxProjectsPerDay) {
                        yearData.maxProjectsPerDay = dayCount;
                    }
                }
            }
        });
        
        // Count active months (only from August onwards)
        for (let month = 7; month < 12; month++) {
            if (yearData.months[month] && Object.keys(yearData.months[month]).length > 0) {
                yearData.activeMonths++;
            }
        }
        
        return yearData;
    }
    
    renderStreakYear(yearData, year) {
        const monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        
        let html = `
            <div class="streak-year-header">
                <div class="streak-year-title">${year} Activity</div>
                <div class="streak-stats">
                    <div class="streak-stat">
                        <div class="streak-stat-value">${yearData.totalProjects}</div>
                        <div class="streak-stat-label">projects</div>
                    </div>
                    <div class="streak-stat">
                        <div class="streak-stat-value">${yearData.totalNotes}</div>
                        <div class="streak-stat-label">notes</div>
                    </div>
                    <div class="streak-stat">
                        <div class="streak-stat-value">${yearData.activeMonths}</div>
                        <div class="streak-stat-label">active months</div>
                    </div>
                </div>
            </div>
            
            <div class="streak-container">
        `;
        
        // Render each month from August onwards
        for (let month = 7; month < 12; month++) {
            const monthData = yearData.months[month];
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            html += `
                <div class="streak-month-row">
                    <div class="streak-month-label">${monthNames[month]}</div>
                    <div class="streak-month-grid">
            `;
            
            // Render each day of the month
            for (let day = 1; day <= daysInMonth; day++) {
                const projects = monthData[day] || [];
                const intensity = this.calculateIntensity(projects, yearData.maxProjectsPerDay);
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                html += `
                    <div class="streak-day ${intensity}" 
                         data-date="${dateStr}" 
                         data-projects='${JSON.stringify(projects.map(p => ({title: p.title, category: p.category})))}' 
                         title="${projects.length} project${projects.length !== 1 ? 's' : ''} on ${monthNames[month]} ${day}">
                    </div>
                `;
            }
            
            // Fill remaining grid slots (max 31 days)
            for (let day = daysInMonth + 1; day <= 31; day++) {
                html += '<div class="streak-day" style="visibility: hidden;"></div>';
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        html += `
            </div>
            <div id="streak-tooltip" class="streak-tooltip"></div>
        `;
        
        return html;
    }
    
    calculateIntensity(projects, maxCount) {
        if (projects.length === 0) return 'empty';
        if (maxCount === 0) return 'empty';
        
        // Check what types of projects we have
        const hasNotes = projects.some(p => this.isNoteProject(p));
        const hasProjects = projects.some(p => !this.isNoteProject(p));
        
        // Determine base color
        let colorBase;
        if (hasNotes && hasProjects) {
            colorBase = 'purple'; // Both notes and projects
        } else if (hasNotes) {
            colorBase = 'green'; // Only notes
        } else {
            colorBase = 'blue'; // Only projects
        }
        
        // Determine intensity level
        const ratio = projects.length / maxCount;
        let level;
        if (ratio <= 0.25) level = '1';
        else if (ratio <= 0.5) level = '2';
        else if (ratio <= 0.75) level = '3';
        else level = '4';
        
        return `${colorBase}-level-${level}`;
    }
    
    addStreakEventListeners() {
        const tooltip = document.getElementById('streak-tooltip');
        
        document.querySelectorAll('.streak-day').forEach(day => {
            day.addEventListener('mouseenter', (e) => {
                const projects = JSON.parse(e.target.dataset.projects || '[]');
                const date = e.target.dataset.date;
                
                if (projects.length > 0) {
                    this.showStreakTooltip(e.target, projects, date, tooltip);
                }
            });
            
            day.addEventListener('mouseleave', () => {
                this.hideStreakTooltip(tooltip);
            });
        });
        
        // Also hide tooltip if mouse moves outside streak container
        const streakView = document.getElementById('streak-view');
        streakView?.addEventListener('mouseleave', () => {
            this.hideStreakTooltip(tooltip);
        });
    }
    
    showStreakTooltip(target, projects, date, tooltip) {
        // Format date nicely
        const formattedDate = new Date(date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
        
        // Create tooltip content
        const projectCount = projects.length;
        const projectWord = projectCount === 1 ? 'project' : 'projects';
        
        const tooltipContent = `
            <div class="tooltip-header mb-2">
                <div class="font-medium text-gray-900">${projectCount} ${projectWord}</div>
                <div class="text-xs text-gray-500">${formattedDate}</div>
            </div>
            <div class="tooltip-projects space-y-1">
                ${projects.map(project => `
                    <div class="project-preview border-l-2 border-blue-200 pl-2 py-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">${(project.category || '').toLowerCase()}</span>
                        </div>
                        <div class="text-sm font-medium text-gray-800">${(project.title || '').toLowerCase()}</div>
                        <div class="text-xs text-gray-600 line-clamp-2">${project.tagline || ''}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        tooltip.innerHTML = tooltipContent;
        
        // Position tooltip
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Calculate position (prefer above the tile, but below if not enough space)
        let top = rect.top - tooltipRect.height - 8;
        if (top < 10) {
            top = rect.bottom + 8;
        }
        
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        
        // Ensure tooltip stays within viewport
        const maxLeft = window.innerWidth - tooltipRect.width - 10;
        const minLeft = 10;
        left = Math.max(minLeft, Math.min(maxLeft, left));
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateY(0)';
    }
    
    hideStreakTooltip(tooltip) {
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(10px)';
    }

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        return new Date(d.setDate(diff));
    }

    getDayOfWeek(date) {
        const day = date.getDay();
        return day === 0 ? 6 : day - 1; // Convert Sunday (0) to 6, Monday (1) to 0, etc.
    }

    formatWeekKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    renderWeek(week) {
        const weekLabel = this.formatWeekLabel(week.weekStart);
        const weekId = `week-${this.formatWeekKey(week.weekStart)}`;
        return `
            <div class="week-container relative" data-week-id="${weekId}">
                <div class="week-label-external absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-full">
                    <div class="week-label week-label-text text-gray-600">
                        ${weekLabel}
                    </div>
                    <div class="week-navigation-container opacity-0 transition-opacity duration-300">
                        <!-- Navigation will be dynamically inserted here -->
                    </div>
                </div>
                <div class="week-row">
                    <div class="grid grid-cols-7 gap-4">
                        ${week.projects.map((dayProjects, dayIndex) => {
                            const dayDate = this.getDayDate(week.weekStart, dayIndex);
                            const dayLabel = this.formatDayLabel(dayDate);
                            const isCurrentDay = this.isToday(dayDate);
                            const currentDayClass = isCurrentDay ? 'current-day-column' : '';
                            const currentDayLabelClass = isCurrentDay ? 'current-day-label' : '';
                            return `
                                <div class="day-container ${currentDayClass}">
                                    <div class="day-label day-date-label text-gray-400 text-center mb-2 ${currentDayLabelClass}">
                                        ${dayLabel}
                                    </div>
                                    ${dayProjects.length > 0 ? this.renderDayCard(dayProjects, dayIndex, weekId, isCurrentDay) : this.renderEmptyCard(dayIndex, isCurrentDay)}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderMiscSection(unscheduledProjects) {
        return `
            <div class="misc-section mt-8 border-t pt-6">
                <div class="misc-header text-center mb-6">
                    <h2 class="text-lg font-semibold text-gray-700 mb-2">unscheduled projects</h2>
                    <p class="text-sm text-gray-500">projects without valid dates in their names</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    ${unscheduledProjects.map(project => this.renderProjectCard(project)).join('')}
                </div>
            </div>
        `;
    }

    formatWeekLabel(weekStart) {
        // Format as "Week of MMM-YY" starting on the associated Monday
        const monthName = weekStart.toLocaleDateString('en-US', { month: 'short' });
        const year = weekStart.getFullYear().toString().slice(-2); // Last 2 digits of year
        return `Week of ${monthName}-${year}`;
    }

    getDayDate(weekStart, dayIndex) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(dayDate.getDate() + dayIndex);
        return dayDate;
    }

    formatDayLabel(date) {
        // Format as "MM-DD"
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${month}-${day}`;
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    getCurrentDayIndex() {
        const today = new Date();
        const day = today.getDay();
        return day === 0 ? 6 : day - 1; // Convert Sunday (0) to 6, Monday (1) to 0, etc.
    }
    
    updateCurrentDayHeader() {
        const currentDayIndex = this.getCurrentDayIndex();
        const dayHeaders = document.querySelectorAll('.calendar-header-row .day-header');
        
        dayHeaders.forEach((header, index) => {
            header.classList.remove('current-day-header');
            if (index === currentDayIndex) {
                header.classList.add('current-day-header');
            }
        });
    }

    renderDayCard(dayProjects, dayIndex, weekId = '', isCurrentDay = false) {
        if (dayProjects.length === 1) {
            return this.renderProjectCard(dayProjects[0], isCurrentDay);
        } else if (dayProjects.length > 1) {
            return this.renderStackedCard(dayProjects, dayIndex, weekId, isCurrentDay);
        }
        return this.renderEmptyCard(dayIndex, isCurrentDay);
    }

    renderStackedCard(projects, dayIndex, weekId = '', isCurrentDay = false) {
        const stackId = `stack-${Date.now()}-${dayIndex}`;
        const currentDayClass = isCurrentDay ? 'current-day-card' : '';
        return `
            <div class="card-stack relative h-68 cursor-pointer ${currentDayClass}" 
                 data-stack-id="${stackId}" 
                 data-expanded="false" 
                 data-current="0"
                 data-week-id="${weekId}"
                 data-total-cards="${projects.length}">
                ${projects.map((project, index) => `
                    <div class="stacked-card absolute inset-0 transition-all duration-300 ease-out ${index > 0 ? 'stacked' : 'active'}" 
                         data-index="${index}"
                         style="transform: translateX(${index * 4}px) translateY(${index * 4}px); z-index: ${projects.length - index};">
                        ${this.renderProjectCardContent(project, index === 0 && projects.length > 1)}
                    </div>
                `).join('')}
                ${projects.length > 1 ? `
                    <div class="stack-indicator absolute top-2 right-2 z-50 transition-opacity duration-300">
                        <div class="stack-count bg-primary text-white px-2 py-1 rounded-full shadow-lg">
                            ${projects.length}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderEmptyCard(dayIndex, isCurrentDay = false) {
        const currentDayClass = isCurrentDay ? 'current-day-empty' : '';
        return `
            <div class="empty-card bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center transition-all hover:border-gray-300 relative ${currentDayClass}" style="height: 17rem;">
                <div class="text-gray-400 text-center">
                    <div class="w-8 h-8 mx-auto mb-2 opacity-50">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 4v16m8-8H4"></path>
                        </svg>
                    </div>
                    <p class="card-metadata">no project</p>
                </div>
            </div>
        `;
    }

    renderProjectCard(project, isCurrentDay = false) {
        const currentDayClass = isCurrentDay ? 'current-day-card' : '';
        const isNote = this.isNoteProject(project);
        const borderColor = isNote ? 'border-green-200' : 'border-gray-100';
        const hoverShadow = isNote ? 'hover:shadow-green-100' : 'hover:shadow-lg';
        
        return `
            <div class="project-card bg-white rounded-xl shadow-sm ${hoverShadow} transition-all duration-300 transform hover:-translate-y-1 h-68 relative border ${borderColor} ${currentDayClass}" 
                 data-github="${project.githubUrl}"
                 data-repo="${project.githubUrl.split('/').slice(-2).join('/')}">
                ${this.renderProjectCardContent(project, false)}
            </div>
        `;
    }

    isNoteProject(project) {
        console.log('Checking project for notes:', project.title, 'Topics:', project.topics);
        
        // Check if it has the notes topic
        if (project.topics && project.topics.includes('notes')) {
            return true;
        }
        
        // Fallback: check if the title contains "daily notes" 
        const isNote = project.title.toLowerCase().includes('daily notes');
        if (isNote) {
            console.log('Detected as note by title pattern:', project.title);
        }
        return isNote;
    }

    renderProjectCardContent(project, hasStackIndicator = false) {
        const isNote = this.isNoteProject(project);
        const categoryColors = isNote 
            ? 'text-green-700 bg-green-50' 
            : 'text-blue-600 bg-blue-50';
        const categoryText = isNote ? 'notes' : 'project';
        
        return `
            <div class="card-content" data-github="${project.githubUrl}" data-repo="${project.githubUrl.split('/').slice(-2).join('/')}">
                <div class="card-header">
                    <span class="card-category ${categoryColors} px-2 py-1 rounded-full">
                        ${categoryText}
                    </span>
                </div>
                
                <div class="card-body">
                    <div class="card-title-section">
                        <h3 class="card-title text-gray-900">${project.title.toLowerCase()}</h3>
                    </div>
                    
                    <div class="card-description-section">
                        <p class="card-description text-gray-600">${project.tagline}</p>
                    </div>
                </div>
                
                <div class="card-footer">
                    <div class="card-actions">
                        <button class="card-link github-link flex items-center text-primary hover:text-blue-600 transition-colors" data-url="${project.githubUrl}">
                            <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0710 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd"></path>
                            </svg>
                            <span>github</span>
                        </button>
                        <button class="card-link readme-link flex items-center text-gray-600 hover:text-gray-800 transition-colors">
                            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <span>${isNote ? 'notes' : 'readme'}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    addProjectEventListeners() {
        // Add click event listeners to buttons
        document.querySelectorAll('.github-link').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const githubUrl = button.dataset.url;
                if (githubUrl) {
                    window.open(githubUrl, '_blank');
                }
            });
        });

        document.querySelectorAll('.readme-link').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const cardContent = button.closest('[data-repo]');
                const repo = cardContent.dataset.repo;
                this.openReadmeModal(repo);
            });
        });

        // Add stacked card interactions
        document.querySelectorAll('.card-stack').forEach(stack => {
            this.addStackInteractions(stack);
        });
    }

    addStackInteractions(stack) {
        const stackId = stack.dataset.stackId;
        const weekId = stack.dataset.weekId;
        const totalCards = parseInt(stack.dataset.totalCards);
        let isExpanded = false;
        let currentIndex = 0;
        const cards = stack.querySelectorAll('.stacked-card');
        
        // Find the week navigation container
        const weekRow = document.querySelector(`[data-week-id="${weekId}"]`);
        const navContainer = weekRow?.querySelector('.week-navigation-container');
        
        // Create navigation elements
        if (navContainer && totalCards > 1) {
            // Get the day index from the stack's position in the grid
            const dayIndex = this.getDayIndexFromStack(stack);
            this.createWeekNavigation(navContainer, stackId, totalCards, dayIndex);
        }

        // Hover state management
        let hoverTimeout;

        const showNavigation = () => {
            if (navContainer && totalCards > 1) {
                clearTimeout(hoverTimeout);
                navContainer.classList.add('active');
                const currentIndexSpan = navContainer.querySelector('.current-index');
                this.updateNavigationCounter(currentIndexSpan, currentIndex + 1);
            }
        };

        const hideNavigation = () => {
            if (navContainer && !isExpanded) {
                hoverTimeout = setTimeout(() => {
                    navContainer.classList.remove('active');
                }, 150); // Small delay to allow mouse movement to navigation
            }
        };

        const cancelHide = () => {
            clearTimeout(hoverTimeout);
        };

        // Hover handlers for stack
        stack.addEventListener('mouseenter', showNavigation);
        stack.addEventListener('mouseleave', hideNavigation);

        // Hover handlers for navigation container
        if (navContainer) {
            navContainer.addEventListener('mouseenter', () => {
                cancelHide();
                showNavigation();
            });
            navContainer.addEventListener('mouseleave', hideNavigation);
        }

        // Main stack click handler
        stack.addEventListener('click', (e) => {
            clearTimeout(hoverTimeout);
            if (!isExpanded) {
                // First click - expand the stack
                this.expandStack(stack, cards);
                isExpanded = true;
                stack.dataset.expanded = 'true';
                if (navContainer) {
                    navContainer.classList.add('active');
                }
            } else {
                // Click elsewhere on expanded stack - collapse it
                this.collapseStack(stack, cards);
                isExpanded = false;
                currentIndex = 0;
                stack.dataset.expanded = 'false';
                stack.dataset.current = '0';
                if (navContainer) {
                    navContainer.classList.remove('active');
                    const currentIndexSpan = navContainer.querySelector('.current-index');
                    this.updateNavigationCounter(currentIndexSpan, 1);
                }
            }
        });

        // Navigation arrow handlers
        if (navContainer) {
            const prevArrow = navContainer.querySelector('.nav-prev');
            const nextArrow = navContainer.querySelector('.nav-next');

            prevArrow?.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                currentIndex = (currentIndex - 1 + totalCards) % totalCards;
                this.cycleToCard(stack, cards, currentIndex);
                stack.dataset.current = currentIndex.toString();
                const currentIndexSpan = navContainer.querySelector('.current-index');
                this.updateNavigationCounter(currentIndexSpan, currentIndex + 1);
            });

            nextArrow?.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                currentIndex = (currentIndex + 1) % totalCards;
                this.cycleToCard(stack, cards, currentIndex);
                stack.dataset.current = currentIndex.toString();
                const currentIndexSpan = navContainer.querySelector('.current-index');
                this.updateNavigationCounter(currentIndexSpan, currentIndex + 1);
            });
        }

        // Handle clicks outside the stack to collapse it
        const outsideClickHandler = (e) => {
            if (!stack.contains(e.target) && !navContainer?.contains(e.target) && isExpanded) {
                clearTimeout(hoverTimeout);
                this.collapseStack(stack, cards);
                isExpanded = false;
                currentIndex = 0;
                stack.dataset.expanded = 'false';
                stack.dataset.current = '0';
                if (navContainer) {
                    navContainer.classList.remove('active');
                    const currentIndexSpan = navContainer.querySelector('.current-index');
                    this.updateNavigationCounter(currentIndexSpan, 1);
                }
            }
        };
        
        document.addEventListener('click', outsideClickHandler);
        
        // Store the handler so we can remove it later if needed
        stack._outsideClickHandler = outsideClickHandler;
    }

    getDayIndexFromStack(stack) {
        // Find the parent grid and get all day slots
        const grid = stack.closest('.grid.grid-cols-7');
        if (!grid) return 0;
        
        const allSlots = Array.from(grid.children);
        const stackSlot = stack.closest('div'); // The immediate parent div in the grid
        return allSlots.indexOf(stackSlot);
    }

    createWeekNavigation(container, stackId, totalCards, dayIndex) {
        // With the new layout, navigation is positioned in the week label container
        container.innerHTML = `
            <div class="stack-navigation" data-stack-id="${stackId}">
                <div class="nav-arrow nav-prev" data-direction="prev">
                    &#8249;
                </div>
                <div class="nav-counter">
                    <span class="nav-counter-text current-index">1</span>/<span class="nav-counter-text total-count">${totalCards}</span>
                </div>
                <div class="nav-arrow nav-next" data-direction="next">
                    &#8250;
                </div>
            </div>
        `;
    }

    updateNavigationCounter(counterElement, currentNumber) {
        if (counterElement) {
            counterElement.textContent = currentNumber;
        }
    }

    expandStack(stack, cards) {
        cards.forEach((card, index) => {
            card.style.transform = `translateX(${index * 12}px) translateY(${index * 12}px)`;
            card.style.zIndex = (cards.length - index + 10).toString();
        });
        stack.classList.add('expanded');
    }

    collapseStack(stack, cards) {
        cards.forEach((card, index) => {
            card.style.transform = `translateX(${index * 4}px) translateY(${index * 4}px)`;
            card.style.zIndex = (cards.length - index).toString();
        });
        stack.classList.remove('expanded');
    }

    cycleToCard(stack, cards, targetIndex) {
        // Bring target card to front and reorganize others
        cards.forEach((card, index) => {
            const adjustedIndex = (index - targetIndex + cards.length) % cards.length;
            card.style.transform = `translateX(${adjustedIndex * 12}px) translateY(${adjustedIndex * 12}px)`;
            card.style.zIndex = (cards.length - adjustedIndex + 10).toString();
        });
    }

    formatDate(project) {
        // Use extracted date if available, otherwise fall back to updated_at
        let date;
        if (project.extractedDate) {
            date = project.extractedDate;
        } else if (typeof project === 'string') {
            // Legacy support for when called with dateString
            date = new Date(project);
        } else {
            date = new Date(project.updated_at);
        }
        
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
        return `${Math.ceil(diffDays / 365)} years ago`;
    }

    setupEventListeners() {
        // Filter toggle functionality
        const filterToggle = document.getElementById('filter-toggle');
        const filterContent = document.getElementById('filter-content');
        const filterChevron = document.getElementById('filter-chevron');
        let isFilterOpen = false;

        filterToggle.addEventListener('click', () => {
            isFilterOpen = !isFilterOpen;
            
            if (isFilterOpen) {
                filterContent.style.maxHeight = filterContent.scrollHeight + 'px';
                filterChevron.style.transform = 'rotate(90deg)';
            } else {
                filterContent.style.maxHeight = '0px';
                filterChevron.style.transform = 'rotate(0deg)';
            }
        });

        // Category filter buttons
        document.getElementById('filter-buttons').addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                // Update button states
                document.querySelectorAll('[data-category]').forEach(btn => {
                    btn.className = 'filter-button px-4 py-2 bg-gray-200 text-gray-700 rounded-full transition-all hover:bg-gray-300';
                });
                e.target.className = 'filter-button px-4 py-2 bg-primary text-white rounded-full transition-all hover:bg-blue-600 active';
                
                // Update filter and re-render
                this.currentFilter = e.target.dataset.category;
                this.renderProjects();
            }
        });
        
        // Zoom control buttons
        document.getElementById('zoom-weekly').addEventListener('click', () => {
            this.setView('weekly');
        });
        
        document.getElementById('zoom-yearly').addEventListener('click', () => {
            this.setView('streak');
        });
    }
    
    setView(viewType) {
        if (this.currentView === viewType) return;
        
        this.currentView = viewType;
        
        // Update button states
        const weeklyBtn = document.getElementById('zoom-weekly');
        const yearlyBtn = document.getElementById('zoom-yearly');
        
        if (viewType === 'weekly') {
            weeklyBtn.className = 'px-3 py-1 text-xs font-medium rounded transition-all hover:bg-white hover:shadow-sm bg-white shadow-sm';
            yearlyBtn.className = 'px-3 py-1 text-xs font-medium rounded transition-all hover:bg-white hover:shadow-sm text-gray-600';
        } else {
            weeklyBtn.className = 'px-3 py-1 text-xs font-medium rounded transition-all hover:bg-white hover:shadow-sm text-gray-600';
            yearlyBtn.className = 'px-3 py-1 text-xs font-medium rounded transition-all hover:bg-white hover:shadow-sm bg-white shadow-sm';
        }
        
        // Re-render with new view
        this.renderProjects();
    }
}

// Initialize the showcase when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ProjectShowcase();
});