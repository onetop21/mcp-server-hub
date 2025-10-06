/**
 * Swagger/OpenAPI Annotations
 * Task 21: API Documentation
 * 
 * This file contains JSDoc annotations for API endpoints
 */

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               username:
 *                 type: string
 *                 example: johndoe
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *     responses:
 *       201:
 *         description: User successfully registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Login user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 */

/**
 * @swagger
 * /api/users/api-keys:
 *   post:
 *     summary: Generate a new API key
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: My Production Key
 *     responses:
 *       201:
 *         description: API key created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiKey'
 *   get:
 *     summary: List all API keys
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 keys:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ApiKey'
 */

/**
 * @swagger
 * /api/servers:
 *   get:
 *     summary: List all servers for current user
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of servers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 servers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Server'
 *   post:
 *     summary: Register a new MCP server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - protocol
 *             properties:
 *               name:
 *                 type: string
 *                 example: My GitHub Server
 *               protocol:
 *                 type: string
 *                 enum: [stdio, sse, http]
 *                 example: stdio
 *               namespace:
 *                 type: string
 *                 example: github
 *               config:
 *                 type: object
 *                 description: Protocol-specific configuration
 *                 properties:
 *                   stdio:
 *                     type: object
 *                     properties:
 *                       command:
 *                         type: string
 *                         example: npx
 *                       args:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["-y", "@modelcontextprotocol/server-github"]
 *                       env:
 *                         type: object
 *                         example: { "GITHUB_TOKEN": "ghp_xxx" }
 *     responses:
 *       201:
 *         description: Server registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Server'
 */

/**
 * @swagger
 * /api/servers/{serverId}:
 *   get:
 *     summary: Get server details
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Server details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Server'
 *       404:
 *         description: Server not found
 *   put:
 *     summary: Update server configuration
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               config:
 *                 type: object
 *     responses:
 *       200:
 *         description: Server updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Server'
 *   delete:
 *     summary: Delete a server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Server deleted
 *       404:
 *         description: Server not found
 */

/**
 * @swagger
 * /api/marketplace:
 *   get:
 *     summary: List all marketplace templates
 *     tags: [Marketplace]
 *     parameters:
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: Filter by tag
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or description
 *     responses:
 *       200:
 *         description: List of marketplace servers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 servers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MarketplaceServer'
 */

/**
 * @swagger
 * /api/marketplace/{templateId}/install:
 *   post:
 *     summary: Install a server from marketplace
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: My GitHub Server
 *               namespace:
 *                 type: string
 *                 example: github
 *               env:
 *                 type: object
 *                 description: Environment variables for the server
 *                 example: { "GITHUB_TOKEN": "ghp_xxx" }
 *     responses:
 *       201:
 *         description: Server installed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Server'
 */

/**
 * @swagger
 * /api/mcp/{endpointId}/tools:
 *   get:
 *     summary: Get available tools for an endpoint
 *     tags: [MCP Protocol]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: endpointId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of available tools
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tools:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tool'
 */

/**
 * @swagger
 * /api/mcp/{endpointId}/tools/call:
 *   post:
 *     summary: Call a tool via MCP protocol
 *     tags: [MCP Protocol]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: endpointId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: create_issue
 *               arguments:
 *                 type: object
 *                 example: { "repo": "owner/repo", "title": "Bug fix", "body": "Description" }
 *     responses:
 *       200:
 *         description: Tool execution result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: object
 *                 error:
 *                   type: string
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Check system health
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Uptime in seconds
 */

export {};

