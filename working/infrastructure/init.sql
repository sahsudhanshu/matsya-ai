
CREATE TABLE IF NOT EXISTS users (
    userId VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    avatar TEXT,
    port VARCHAR(255),
    customPort VARCHAR(255),
    region VARCHAR(255),
    role VARCHAR(50) DEFAULT 'fisherman',
    preferences JSON,
    publicProfileEnabled TINYINT(1) DEFAULT 0,
    publicProfileSlug VARCHAR(255),
    showPublicStats TINYINT(1) DEFAULT 0,
    createdAt VARCHAR(50),
    updatedAt VARCHAR(50),
    INDEX email_index (email),
    INDEX slug_index (publicProfileSlug)
);

CREATE TABLE IF NOT EXISTS images (
    imageId VARCHAR(255) PRIMARY KEY,
    userId VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    analysisResult JSON,
    weightEstimates JSON,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    s3Key VARCHAR(1024),
    createdAt VARCHAR(50) NOT NULL,
    updatedAt VARCHAR(50),
    ttl BIGINT,
    INDEX userId_createdAt_index (userId, createdAt),
    INDEX status_createdAt_index (status, createdAt),
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chats (
    chatId VARCHAR(255) PRIMARY KEY,
    userId VARCHAR(255) NOT NULL,
    timestamp VARCHAR(50) NOT NULL,
    message TEXT,
    role VARCHAR(50) DEFAULT 'user',
    INDEX userId_timestamp_index (userId, timestamp),
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversations (
    conversationId VARCHAR(255) PRIMARY KEY,
    userId VARCHAR(255) NOT NULL,
    title VARCHAR(512) DEFAULT 'New Chat',
    language VARCHAR(10) DEFAULT 'en',
    summary TEXT,
    messageCount INT DEFAULT 0,
    createdAt VARCHAR(50),
    updatedAt VARCHAR(50) NOT NULL,
    INDEX userId_updatedAt_index (userId, updatedAt),
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    messageId VARCHAR(255) PRIMARY KEY,
    conversationId VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT,
    toolCalls JSON,
    metadata JSON,
    timestamp VARCHAR(50) NOT NULL,
    INDEX conv_timestamp_index (conversationId, timestamp),
    FOREIGN KEY (conversationId) REFERENCES conversations(conversationId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory (
    userId VARCHAR(255) PRIMARY KEY,
    facts TEXT,
    updatedAt VARCHAR(50),
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `groups` (
    groupId VARCHAR(255) PRIMARY KEY,
    userId VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    imageCount INT DEFAULT 0,
    s3Keys JSON,
    analysisResult JSON,
    weightEstimates JSON,
    errors JSON,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    createdAt VARCHAR(50) NOT NULL,
    updatedAt VARCHAR(50),
    INDEX userId_createdAt_index (userId, createdAt),
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS telegram_subs (
    telegramChatId VARCHAR(100) PRIMARY KEY,
    userId VARCHAR(255),
    latitude VARCHAR(50),
    longitude VARCHAR(50),
    locationName VARCHAR(512),
    language VARCHAR(10) DEFAULT 'en',
    alertsEnabled TINYINT(1) DEFAULT 1,
    subscribedAt VARCHAR(50),
    updatedAt VARCHAR(50)
);

-- RAG knowledge base (replaces OpenSearch / AOSS)
-- Stores fish species, disease, regulation, and fishing knowledge documents.
-- ChromaDB uses this table as the source of truth; embeddings are cached locally.
CREATE TABLE IF NOT EXISTS fish_knowledge (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doc_id VARCHAR(255) UNIQUE NOT NULL,     -- stable ID used by ChromaDB
    topic VARCHAR(100) NOT NULL,             -- e.g. 'species', 'disease', 'regulation'
    title VARCHAR(512) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    source VARCHAR(512),                     -- e.g. 'CMFRI', 'manual'
    createdAt VARCHAR(50),
    updatedAt VARCHAR(50),
    FULLTEXT KEY ft_knowledge (title, content),
    INDEX topic_idx (topic),
    INDEX lang_idx (language)
);

