package com.example.elasticclient;

import java.text.DateFormat;
import java.util.Date;
import java.util.Random;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import com.example.elasticclient.entity.IapLogItem;
import com.example.elasticclient.entity.RewardedAdsLogItem;

@SpringBootApplication
public class ElasticclientApplication {

	public static void main(String[] args) {
		SpringApplication.run(ElasticclientApplication.class, args);

		new ElasticclientApplication().TestRewardedAds();
	}

	public void TestIap() {

		ElasticSearchConnect connector = new ElasticSearchConnect();
		connector.Connect();

		try {
			for (int i = 0; i < 100; i++) {
				int index = i + 200;
				Date d = DateFormat.getDateInstance(DateFormat.SHORT).parse("09/01/25 00:00:00");
				d = new Date(d.getTime() + i * 86400000L);
				IapLogItem iapLogItem = new IapLogItem("user" + i, "game1", "purchase", "store", "special_offer",
						"iOS", "1.0.0", i * 2 + 1, 10, d, d, "product_" + (i % 10), "transaction_" + i, "order_" + i,
						"completed",
						"receipt_data", "USD", "purchase_token_" + i, (i % 5) * 2.99f);
				// connector.deleteIapLog("iap_"+(i*103));
				connector.onIapLog("iap_" + (index * 103), iapLogItem);
			}
		} catch (Exception e) {
		}
	}

	public void TestRewardedAds() {

		ElasticSearchConnect connector = new ElasticSearchConnect();
		connector.Connect();

		String placements[] = { "Buy Skill", "Revive", "Offer" };
		String platforms[] = { "iOS", "Android" };
		String countries[] = { "US", "UK", "CA", "AU", "DE" };

		try {
			for (int i = 0; i < 100; i++) {
				int index = i + 200;
				Date d = DateFormat.getDateInstance(DateFormat.SHORT).parse("01/01/26 00:00:00");
				int r = new Random().nextInt(100);
				d = new Date(d.getTime() + (r % 7) * 86400000L);
				RewardedAdsLogItem rewardedAdsLogItem = new RewardedAdsLogItem("user" + i, platforms[r % 2],
						countries[r % 5], "1.0.0", "" + (r%50),
						r, d, d, placements[r % 3], "");
				//connector.deleteRewardedAds("rewarded_ads_" + (i * 102));
				connector.onRewardedAds("rewarded_"+(index*102), rewardedAdsLogItem);
			}
		} catch (Exception e) {
		}
	}

}
