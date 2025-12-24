package com.example.elasticclient;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ElasticclientApplication {

	public static void main(String[] args) {
		SpringApplication.run(ElasticclientApplication.class, args);

		ElasticSearchConnect connector = new ElasticSearchConnect();
		connector.Connect();

		connector.Search();

	}

}
