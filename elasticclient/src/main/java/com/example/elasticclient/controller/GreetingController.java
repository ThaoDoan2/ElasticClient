package com.example.elasticclient.controller;

import java.util.concurrent.atomic.AtomicLong;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GreetingController {

    
    @GetMapping("/greeting")
    public String greeting() {
        return "Hello, World!";
    }
}
