package com.example.elasticclient.config;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;


public class ElasticsearchConfig{

    public static String host;
    public static String userName;
    public static String password;

    public void LoadConfig(){

        Properties props = new Properties();
        try (InputStream input = getClass().getClassLoader().getResourceAsStream("application.properties")) {
            if (input != null) {
                props.load(input);
                host = props.getProperty("elastic.host", "https://localhost:9200");
                userName = props.getProperty("elastic.userName", "elastic");
                password = props.getProperty("elastic.password", "");
            } else {
                System.err.println("application.properties not found, using defaults");
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}