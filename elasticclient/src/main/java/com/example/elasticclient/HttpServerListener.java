package com.example.elasticclient;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.example.elasticclient.entity.IapLogItem;
import com.example.elasticclient.entity.LevelPlayLogItem;
import com.example.elasticclient.entity.RewardedAdsLogItem;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

public class HttpServerListener {
    private static final Logger logger = LogManager.getLogger(HttpServerListener.class);
    private static final int PORT = 8080;
    private static final String CONTEXT = "/logEvent";
    private static final ObjectMapper objectMapper = new ObjectMapper();
    // API key for security
    private static final String API_KEY = "changeme-123456"; // Change this to your secure key
    private static final String API_KEY_HEADER = "X-API-KEY";

    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext(CONTEXT, new RewardedAdsLogHandler());
        server.setExecutor(null); // creates a default executor
        System.out.println("HTTP server started on port " + PORT);
        server.start();
    }

    static class RewardedAdsLogHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            // Check API key
            String apiKey = exchange.getRequestHeaders().getFirst(API_KEY_HEADER);
            if (apiKey == null || !API_KEY.equals(apiKey)) {
                String response = "Unauthorized: Invalid API Key";
                exchange.sendResponseHeaders(401, response.length());
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(response.getBytes());
                }
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try (InputStream is = exchange.getRequestBody()) {
                    // Read the JSON as a tree to get eventType
                    com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(is);
                    if (!root.has("eventType")) {
                        String response = "Missing eventType field";
                        exchange.sendResponseHeaders(400, response.length());
                        try (OutputStream os = exchange.getResponseBody()) {
                            os.write(response.getBytes());
                        }
                        return;
                    }
                    String eventType = root.get("eventType").asText();
                    String response;
                    ObjectNode logNode = objectMapper.createObjectNode();
                    logNode.put("eventType", eventType);
                    logNode.put("timestamp", System.currentTimeMillis());
                    switch (eventType) {
                        case "rewarded": {
                            RewardedAdsLogItem logItem = objectMapper.treeToValue(root, RewardedAdsLogItem.class);
                            logNode.set("data", objectMapper.valueToTree(logItem));
                            response = "Logged RewardedAds event";
                            break;
                        }
                        case "iap": {
                            IapLogItem logItem = objectMapper.treeToValue(root, IapLogItem.class);
                            logNode.set("data", objectMapper.valueToTree(logItem));
                            response = "Logged IAP event";
                            break;
                        }
                        case "level": {
                            LevelPlayLogItem logItem = objectMapper.treeToValue(root, LevelPlayLogItem.class);
                            logNode.set("data", objectMapper.valueToTree(logItem));
                            response = "Logged LevelPlay event";
                            break;
                        }
                        default: {
                            response = "Unknown eventType: " + eventType;
                            exchange.sendResponseHeaders(400, response.length());
                            try (OutputStream os = exchange.getResponseBody()) {
                                os.write(response.getBytes());
                            }
                            return;
                        }
                    }
                    // Output log as JSON for Logstash using Log4j2
                    logger.info(objectMapper.writeValueAsString(logNode));
                    exchange.sendResponseHeaders(200, response.length());
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(response.getBytes());
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    String response = "Error: " + e.getMessage();
                    exchange.sendResponseHeaders(500, response.length());
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(response.getBytes());
                    }
                }
            } else {
                String response = "Method Not Allowed";
                exchange.sendResponseHeaders(405, response.length());
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(response.getBytes());
                }
            }
        }
    }
}