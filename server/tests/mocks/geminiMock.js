class GoogleGenerativeAI {
  getGenerativeModel() {
    return {
      generateContentStream: jest.fn().mockResolvedValue({
        stream: [{ text: () => 'Mock AI Response' }]
      }),
      generateContent: jest.fn().mockResolvedValue({
        response: { text: () => 'Mock AI Response' }
      })
    };
  }
}
module.exports = { GoogleGenerativeAI };
