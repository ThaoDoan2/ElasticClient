package com.example.elasticclient;

import java.text.DateFormat;
import java.text.ParseException;
import java.util.Date;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import com.example.elasticclient.entity.RewardedAdsLogItem;

@SpringBootApplication
public class ElasticclientApplication {

	public static void main(String[] args) {
		SpringApplication.run(ElasticclientApplication.class, args);

		ElasticSearchConnect connector = new ElasticSearchConnect();
		connector.Connect();

		try {
			for (int i = 0; i < 100; i ++){
				Date d = DateFormat.getDateInstance(DateFormat.SHORT).parse("11/01/25 00:00:00");
				d = new Date(d.getTime() + i *86400000L);
				connector.onRewardedAds("rewarded_ads_"+(i*102), new RewardedAdsLogItem("user" + i, "iOS", 
		"US", "1.0.0", String.valueOf(i+1), 10, d, "main_menu", "top_banner"));	
			}
		
		} catch (ParseException e) {
			e.printStackTrace();
		}
	}

}
