package com.example.elasticclient;

import java.text.DateFormat;
import java.util.Date;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import com.example.elasticclient.entity.IapLogItem;

@SpringBootApplication
public class ElasticclientApplication {

	public static void main(String[] args) {
		SpringApplication.run(ElasticclientApplication.class, args);

		new ElasticclientApplication().TestIap();
	}

	public void TestIap(){

		ElasticSearchConnect connector = new ElasticSearchConnect();
		connector.Connect();

		try {
			for (int i = 0; i < 100; i ++){
				int index = i +200;
				Date d = DateFormat.getDateInstance(DateFormat.SHORT).parse("09/01/25 00:00:00");
				d = new Date(d.getTime() + i *86400000L);
				IapLogItem iapLogItem = new IapLogItem("user" + i, "game1", "purchase", "store", "special_offer", 
						"iOS", "1.0.0", i *2+1, 10, d, d, "product_"+ (i % 10), "transaction_"+i, "order_"+i, "completed", 
						"receipt_data", "USD", "purchase_token_"+i, (i % 5) *2.99f);
				//connector.deleteIapLog("iap_"+(i*103));
				connector.onIapLog("iap_"+(index*103), iapLogItem);
			}
		} catch (Exception e) {
		}
	}

}
