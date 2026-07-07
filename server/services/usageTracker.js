class UsageTracker {
  constructor() {
    this.chatRequests = []; // Array of { timestamp, tokens }
    this.embeddingRequests = []; // Array of timestamps
    this.dailyEmbeddings = 0;
    this.lastReset = new Date().toDateString();
  }

  _cleanOldRecords(now) {
    const oneMinuteAgo = now - 60 * 1000;
    // Remove requests older than 1 minute
    this.chatRequests = this.chatRequests.filter(req => req.timestamp > oneMinuteAgo);
    this.embeddingRequests = this.embeddingRequests.filter(ts => ts > oneMinuteAgo);
  }

  _checkDailyReset(nowDate) {
    if (nowDate.toDateString() !== this.lastReset) {
      this.dailyEmbeddings = 0;
      this.lastReset = nowDate.toDateString();
    }
  }

  trackChatRequest(tokens = 0) {
    const now = Date.now();
    this._cleanOldRecords(now);
    this.chatRequests.push({ timestamp: now, tokens });
  }

  trackEmbeddingRequest() {
    const now = new Date();
    this._cleanOldRecords(now.getTime());
    this._checkDailyReset(now);
    
    this.embeddingRequests.push(now.getTime());
    this.dailyEmbeddings++;
  }

  getUsage() {
    const now = Date.now();
    this._cleanOldRecords(now);
    this._checkDailyReset(new Date(now));

    const chatRpm = this.chatRequests.length;
    const chatTpm = this.chatRequests.reduce((sum, req) => sum + req.tokens, 0);
    const embeddingRpm = this.embeddingRequests.length;

    // Time when the oldest request will drop out of the 1-minute window
    let nextRefresh = null;
    if (this.chatRequests.length > 0) {
       // Oldest request is at index 0 because we push to the end
       nextRefresh = this.chatRequests[0].timestamp + 60000; 
    }

    return {
      chat: {
        rpm: chatRpm,
        tpm: chatTpm,
        nextRefresh
      },
      embeddings: {
        rpm: embeddingRpm,
        daily: this.dailyEmbeddings
      }
    };
  }
}

// Export a singleton instance
module.exports = new UsageTracker();
